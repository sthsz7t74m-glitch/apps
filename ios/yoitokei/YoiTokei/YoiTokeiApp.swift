import SwiftUI
import UserNotifications

struct Alarm: Identifiable, Codable, Equatable {
    var id = UUID()
    var hour: Int
    var minute: Int
    var label: String
    var isEnabled = true

    var timeText: String { String(format: "%02d:%02d", hour, minute) }
}

actor NotificationManager {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()

    func requestPermission() async {
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func schedule(_ alarm: Alarm) async {
        center.removePendingNotificationRequests(withIdentifiers: [alarm.id.uuidString])
        guard alarm.isEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = alarm.label.isEmpty ? "アラーム" : alarm.label
        content.body = alarm.timeText
        content.sound = .default

        var components = DateComponents()
        components.hour = alarm.hour
        components.minute = alarm.minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: alarm.id.uuidString, content: content, trigger: trigger)
        try? await center.add(request)
    }

    func remove(_ alarm: Alarm) {
        center.removePendingNotificationRequests(withIdentifiers: [alarm.id.uuidString])
    }
}

@MainActor
final class AlarmStore: ObservableObject {
    @Published var alarms: [Alarm] = [] { didSet { save() } }
    private let key = "yoitokei.alarms"

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([Alarm].self, from: data) {
            alarms = decoded
        }
    }

    func save() {
        guard let data = try? JSONEncoder().encode(alarms) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    func add(_ alarm: Alarm) async {
        alarms.append(alarm)
        alarms.sort { ($0.hour, $0.minute) < ($1.hour, $1.minute) }
        await NotificationManager.shared.schedule(alarm)
    }

    func toggle(_ alarm: Alarm) async {
        guard let index = alarms.firstIndex(of: alarm) else { return }
        alarms[index].isEnabled.toggle()
        await NotificationManager.shared.schedule(alarms[index])
    }

    func delete(at offsets: IndexSet) async {
        let targets = offsets.map { alarms[$0] }
        alarms.remove(atOffsets: offsets)
        for alarm in targets { await NotificationManager.shared.remove(alarm) }
    }
}

@main
struct YoiTokeiApp: App {
    @StateObject private var store = AlarmStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .task { await NotificationManager.shared.requestPermission() }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            ClockView()
                .tabItem { Label("時計", systemImage: "clock") }
            AlarmListView()
                .tabItem { Label("アラーム", systemImage: "alarm") }
            TimerView()
                .tabItem { Label("タイマー", systemImage: "timer") }
            StopwatchView()
                .tabItem { Label("ストップウォッチ", systemImage: "stopwatch") }
        }
    }
}

struct ClockView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Spacer()
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(context.date.formatted(date: .omitted, time: .standard))
                        .font(.system(size: 62, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(context.date.formatted(.dateTime.year().month().day().weekday().locale(Locale(identifier: "ja_JP"))))
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("よい時計")
        }
    }
}

struct AlarmListView: View {
    @EnvironmentObject private var store: AlarmStore
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            Group {
                if store.alarms.isEmpty {
                    ContentUnavailableView("アラームがありません", systemImage: "alarm", description: Text("右上の＋から追加できます"))
                } else {
                    List {
                        ForEach(store.alarms) { alarm in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(alarm.timeText)
                                        .font(.system(size: 38, weight: .semibold, design: .rounded))
                                        .monospacedDigit()
                                    Text(alarm.label.isEmpty ? "アラーム" : alarm.label)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Toggle("", isOn: Binding(get: { alarm.isEnabled }, set: { _ in Task { await store.toggle(alarm) } }))
                                    .labelsHidden()
                            }
                        }
                        .onDelete { offsets in Task { await store.delete(at: offsets) } }
                    }
                }
            }
            .navigationTitle("アラーム")
            .toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }
            .sheet(isPresented: $showingAdd) { AlarmEditorView() }
        }
    }
}

struct AlarmEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AlarmStore
    @State private var time = Calendar.current.date(from: DateComponents(hour: 7, minute: 0)) ?? Date()
    @State private var label = "目覚まし"

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("時刻", selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                TextField("アラーム名", text: $label)
            }
            .navigationTitle("アラームを追加")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        let c = Calendar.current.dateComponents([.hour, .minute], from: time)
                        Task {
                            await store.add(Alarm(hour: c.hour ?? 7, minute: c.minute ?? 0, label: label))
                            dismiss()
                        }
                    }
                    .bold()
                }
            }
        }
    }
}

struct TimerView: View {
    @State private var seconds = 300
    @State private var running = false
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()
                Text(String(format: "%02d:%02d", seconds / 60, seconds % 60))
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .monospacedDigit()
                HStack {
                    Button(running ? "一時停止" : "開始") { running.toggle() }
                        .buttonStyle(.borderedProminent)
                    Button("リセット") { running = false; seconds = 300 }
                        .buttonStyle(.bordered)
                }
                Spacer()
            }
            .navigationTitle("タイマー")
            .onReceive(tick) { _ in if running && seconds > 0 { seconds -= 1 } }
        }
    }
}

struct StopwatchView: View {
    @State private var elapsed = 0.0
    @State private var running = false
    private let tick = Timer.publish(every: 0.01, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()
                Text(String(format: "%02d:%05.2f", Int(elapsed) / 60, elapsed.truncatingRemainder(dividingBy: 60)))
                    .font(.system(size: 54, weight: .bold, design: .rounded))
                    .monospacedDigit()
                HStack {
                    Button(running ? "停止" : "開始") { running.toggle() }
                        .buttonStyle(.borderedProminent)
                    Button("リセット") { running = false; elapsed = 0 }
                        .buttonStyle(.bordered)
                }
                Spacer()
            }
            .navigationTitle("ストップウォッチ")
            .onReceive(tick) { _ in if running { elapsed += 0.01 } }
        }
    }
}
