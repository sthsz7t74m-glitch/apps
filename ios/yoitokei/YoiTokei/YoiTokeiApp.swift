import SwiftUI
import UserNotifications

// MARK: - Models

struct Alarm: Identifiable, Codable, Equatable {
    var id = UUID()
    var hour: Int
    var minute: Int
    var label: String
    var isEnabled = true
    var repeatDays: Set<Weekday> = []
    var snoozeMinutes = 5

    var timeText: String { String(format: "%02d:%02d", hour, minute) }

    var repeatText: String {
        if repeatDays.isEmpty { return "毎日" }
        return Weekday.allCases
            .filter { repeatDays.contains($0) }
            .map(\.shortName)
            .joined()
    }
}

enum Weekday: Int, Codable, CaseIterable, Identifiable {
    case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday

    var id: Int { rawValue }

    var shortName: String {
        switch self {
        case .sunday: "日"
        case .monday: "月"
        case .tuesday: "火"
        case .wednesday: "水"
        case .thursday: "木"
        case .friday: "金"
        case .saturday: "土"
        }
    }
}

// MARK: - Notification

actor NotificationManager {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()

    func requestPermission() async {
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func authorizationText() async -> String {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: "許可"
        case .denied: "拒否"
        case .notDetermined: "未設定"
        @unknown default: "不明"
        }
    }

    func schedule(_ alarm: Alarm) async {
        await remove(alarm)
        guard alarm.isEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = alarm.label.isEmpty ? "アラーム" : alarm.label
        content.body = alarm.timeText
        content.sound = .default

        if alarm.repeatDays.isEmpty {
            var components = DateComponents()
            components.hour = alarm.hour
            components.minute = alarm.minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let request = UNNotificationRequest(
                identifier: notificationID(alarm, suffix: "daily"),
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
            return
        }

        for weekday in alarm.repeatDays {
            var components = DateComponents()
            components.weekday = weekday.rawValue
            components.hour = alarm.hour
            components.minute = alarm.minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let request = UNNotificationRequest(
                identifier: notificationID(alarm, suffix: "weekday-\(weekday.rawValue)"),
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
        }
    }

    func remove(_ alarm: Alarm) async {
        let requests = await center.pendingNotificationRequests()
        let prefix = "alarm-\(alarm.id.uuidString)-"
        let ids = requests.map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    private func notificationID(_ alarm: Alarm, suffix: String) -> String {
        "alarm-\(alarm.id.uuidString)-\(suffix)"
    }
}

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }
}

// MARK: - Stores

@MainActor
final class AlarmStore: ObservableObject {
    @Published private(set) var alarms: [Alarm] = [] { didSet { save() } }
    private let key = "yoitokei.alarms.v2"

    init() {
        load()
    }

    func add(_ alarm: Alarm) async {
        alarms.append(alarm)
        sort()
        await NotificationManager.shared.schedule(alarm)
    }

    func update(_ alarm: Alarm) async {
        guard let index = alarms.firstIndex(where: { $0.id == alarm.id }) else { return }
        alarms[index] = alarm
        sort()
        await NotificationManager.shared.schedule(alarm)
    }

    func toggle(_ alarm: Alarm) async {
        var updated = alarm
        updated.isEnabled.toggle()
        await update(updated)
    }

    func delete(at offsets: IndexSet) async {
        let targets = offsets.map { alarms[$0] }
        alarms.remove(atOffsets: offsets)
        for alarm in targets { await NotificationManager.shared.remove(alarm) }
    }

    func rescheduleAll() async {
        for alarm in alarms where alarm.isEnabled {
            await NotificationManager.shared.schedule(alarm)
        }
    }

    private func sort() {
        alarms.sort { ($0.hour, $0.minute) < ($1.hour, $1.minute) }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(alarms) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([Alarm].self, from: data)
        else { return }
        alarms = decoded
        sort()
    }
}

@MainActor
final class AppSettings: ObservableObject {
    @AppStorage("yoitokei.use24Hour") var use24Hour = true
    @AppStorage("yoitokei.appearance") var appearance = "system"

    var colorScheme: ColorScheme? {
        switch appearance {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }
}

// MARK: - App

@main
struct YoiTokeiApp: App {
    @StateObject private var store = AlarmStore()
    @StateObject private var settings = AppSettings()

    init() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(settings)
                .preferredColorScheme(settings.colorScheme)
                .task {
                    await NotificationManager.shared.requestPermission()
                    await store.rescheduleAll()
                }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            ClockView().tabItem { Label("時計", systemImage: "clock") }
            AlarmListView().tabItem { Label("アラーム", systemImage: "alarm") }
            TimerView().tabItem { Label("タイマー", systemImage: "timer") }
            StopwatchView().tabItem { Label("ストップウォッチ", systemImage: "stopwatch") }
            SettingsView().tabItem { Label("設定", systemImage: "gearshape") }
        }
    }
}

// MARK: - Clock

struct ClockView: View {
    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [.indigo.opacity(0.22), .cyan.opacity(0.08), .clear],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 18) {
                    Spacer()
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(timeText(context.date))
                            .font(.system(size: 67, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .minimumScaleFactor(0.58)
                            .lineLimit(1)

                        Text(context.date.formatted(
                            .dateTime.year().month(.wide).day().weekday(.wide)
                                .locale(Locale(identifier: "ja_JP"))
                        ))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("v1.1.0")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding()
            }
            .navigationTitle("よい時計")
        }
    }

    private func timeText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.dateFormat = settings.use24Hour ? "HH:mm:ss" : "h:mm:ss a"
        return formatter.string(from: date)
    }
}

// MARK: - Alarm

struct AlarmListView: View {
    @EnvironmentObject private var store: AlarmStore
    @State private var selectedAlarm: Alarm?
    @State private var showingEditor = false

    var body: some View {
        NavigationStack {
            Group {
                if store.alarms.isEmpty {
                    ContentUnavailableView(
                        "アラームがありません",
                        systemImage: "alarm",
                        description: Text("右上の＋から追加できます")
                    )
                } else {
                    List {
                        ForEach(store.alarms) { alarm in
                            Button {
                                selectedAlarm = alarm
                                showingEditor = true
                            } label: {
                                HStack(spacing: 14) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(alarm.timeText)
                                            .font(.system(size: 38, weight: .semibold, design: .rounded))
                                            .monospacedDigit()
                                        Text("\(alarm.label.isEmpty ? "アラーム" : alarm.label) ・ \(alarm.repeatText)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Toggle("", isOn: Binding(
                                        get: { alarm.isEnabled },
                                        set: { _ in Task { await store.toggle(alarm) } }
                                    ))
                                    .labelsHidden()
                                }
                                .contentShape(Rectangle())
                                .padding(.vertical, 5)
                            }
                            .buttonStyle(.plain)
                        }
                        .onDelete { offsets in Task { await store.delete(at: offsets) } }
                    }
                }
            }
            .navigationTitle("アラーム")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        selectedAlarm = nil
                        showingEditor = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingEditor) {
                AlarmEditorView(alarm: selectedAlarm)
            }
        }
    }
}

struct AlarmEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AlarmStore

    let original: Alarm?
    @State private var time: Date
    @State private var label: String
    @State private var repeatDays: Set<Weekday>
    @State private var snoozeMinutes: Int

    init(alarm: Alarm?) {
        original = alarm
        _time = State(initialValue: Calendar.current.date(
            from: DateComponents(hour: alarm?.hour ?? 7, minute: alarm?.minute ?? 0)
        ) ?? Date())
        _label = State(initialValue: alarm?.label ?? "目覚まし")
        _repeatDays = State(initialValue: alarm?.repeatDays ?? [])
        _snoozeMinutes = State(initialValue: alarm?.snoozeMinutes ?? 5)
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("時刻", selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)

                Section("名前") {
                    TextField("例：仕事", text: $label)
                }

                Section("繰り返し") {
                    HStack {
                        ForEach(Weekday.allCases) { day in
                            Button {
                                if repeatDays.contains(day) { repeatDays.remove(day) }
                                else { repeatDays.insert(day) }
                            } label: {
                                Text(day.shortName)
                                    .font(.subheadline.bold())
                                    .frame(width: 34, height: 34)
                                    .background(repeatDays.contains(day) ? Color.accentColor : Color.secondary.opacity(0.15))
                                    .foregroundStyle(repeatDays.contains(day) ? .white : .primary)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }

                Section("スヌーズ") {
                    Picker("時間", selection: $snoozeMinutes) {
                        Text("なし").tag(0)
                        Text("5分").tag(5)
                        Text("10分").tag(10)
                        Text("15分").tag(15)
                    }
                }
            }
            .navigationTitle(original == nil ? "アラームを追加" : "アラームを編集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { Task { await saveAlarm() } }.bold()
                }
            }
        }
    }

    private func saveAlarm() async {
        let components = Calendar.current.dateComponents([.hour, .minute], from: time)
        var alarm = original ?? Alarm(
            hour: components.hour ?? 7,
            minute: components.minute ?? 0,
            label: label
        )
        alarm.hour = components.hour ?? 7
        alarm.minute = components.minute ?? 0
        alarm.label = label.trimmingCharacters(in: .whitespacesAndNewlines)
        alarm.repeatDays = repeatDays
        alarm.snoozeMinutes = snoozeMinutes

        if original == nil { await store.add(alarm) }
        else { await store.update(alarm) }
        dismiss()
    }
}

// MARK: - Timer

struct TimerView: View {
    @State private var selectedSeconds = 300
    @State private var remainingSeconds = 300
    @State private var running = false
    @State private var endDate: Date?
    private let tick = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()
                Text(format(remainingSeconds))
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .monospacedDigit()

                if !running {
                    Picker("時間", selection: $selectedSeconds) {
                        ForEach([60, 180, 300, 600, 900, 1800, 3600], id: \.self) { seconds in
                            Text(seconds < 3600 ? "\(seconds / 60)分" : "1時間").tag(seconds)
                        }
                    }
                    .pickerStyle(.wheel)
                    .onChange(of: selectedSeconds) { _, value in remainingSeconds = value }
                }

                HStack(spacing: 16) {
                    Button(running ? "一時停止" : "開始") {
                        running ? pause() : start()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button("リセット") { reset() }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("タイマー")
            .onReceive(tick) { now in
                guard running, let endDate else { return }
                remainingSeconds = max(0, Int(ceil(endDate.timeIntervalSince(now))))
                if remainingSeconds == 0 {
                    running = false
                    self.endDate = nil
                }
            }
        }
    }

    private func start() {
        if remainingSeconds <= 0 { remainingSeconds = selectedSeconds }
        endDate = Date().addingTimeInterval(TimeInterval(remainingSeconds))
        running = true
    }

    private func pause() {
        if let endDate { remainingSeconds = max(0, Int(ceil(endDate.timeIntervalSinceNow))) }
        self.endDate = nil
        running = false
    }

    private func reset() {
        running = false
        endDate = nil
        remainingSeconds = selectedSeconds
    }

    private func format(_ seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

// MARK: - Stopwatch

struct StopwatchView: View {
    @State private var elapsed: TimeInterval = 0
    @State private var storedElapsed: TimeInterval = 0
    @State private var startedAt: Date?
    @State private var laps: [TimeInterval] = []
    private let tick = Timer.publish(every: 0.03, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Text(format(elapsed))
                    .font(.system(size: 54, weight: .bold, design: .rounded))
                    .monospacedDigit()

                HStack(spacing: 14) {
                    Button(startedAt == nil ? "開始" : "停止") {
                        startedAt == nil ? start() : stop()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button("ラップ") { laps.insert(elapsed, at: 0) }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        .disabled(startedAt == nil)

                    Button("リセット") { reset() }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                }

                List(Array(laps.enumerated()), id: \.offset) { index, lap in
                    HStack {
                        Text("ラップ \(laps.count - index)")
                        Spacer()
                        Text(format(lap)).monospacedDigit()
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("ストップウォッチ")
            .onReceive(tick) { now in
                guard let startedAt else { return }
                elapsed = storedElapsed + now.timeIntervalSince(startedAt)
            }
        }
    }

    private func start() { startedAt = Date() }
    private func stop() {
        storedElapsed = elapsed
        startedAt = nil
    }
    private func reset() {
        startedAt = nil
        elapsed = 0
        storedElapsed = 0
        laps.removeAll()
    }
    private func format(_ value: TimeInterval) -> String {
        let total = Int(value * 100)
        return String(format: "%02d:%02d.%02d", total / 6000, (total / 100) % 60, total % 100)
    }
}

// MARK: - Settings

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var notificationStatus = "確認中"

    var body: some View {
        NavigationStack {
            Form {
                Section("時計") {
                    Toggle("24時間表示", isOn: $settings.use24Hour)
                }
                Section("外観") {
                    Picker("表示", selection: $settings.appearance) {
                        Text("端末設定").tag("system")
                        Text("ライト").tag("light")
                        Text("ダーク").tag("dark")
                    }
                }
                Section("通知") {
                    LabeledContent("通知許可", value: notificationStatus)
                    Button("通知許可を再確認") {
                        Task {
                            await NotificationManager.shared.requestPermission()
                            notificationStatus = await NotificationManager.shared.authorizationText()
                        }
                    }
                }
                Section("アプリ") {
                    LabeledContent("バージョン", value: "1.1.0")
                    Text("消音モード・集中モード・通知設定によって、アラーム音が鳴らない場合があります。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("設定")
            .task { notificationStatus = await NotificationManager.shared.authorizationText() }
        }
    }
}
