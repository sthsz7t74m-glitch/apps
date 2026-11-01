/* Offenbach: Orpheus in the Underworld - Can Can section.
   Original Musopen performance, released to public domain on Wikimedia Commons.
   https://commons.wikimedia.org/wiki/File:Offenbach_-_Orpheus_in_the_Underworld_-_Overture,_Can_Can_section.ogg
   The recording plays unaltered; race stop halts playback. */
(function(){
  'use strict';
  const filename='Offenbach_-_Orpheus_in_the_Underworld_-_Overture%2C_Can_Can_section.ogg';
  const base='https://upload.wikimedia.org/wikipedia/commons/';
  const mp3=base+'transcoded/6/63/'+filename+'/'+filename+'.mp3';
  const ogg=base+'6/63/'+filename;
  const audio=new Audio();
  audio.preload='auto';
  audio.volume=.65;
  audio.loop=false;
  let fallbackUsed=false;
  audio.src=mp3;
  audio.addEventListener('error',()=>{
    if(fallbackUsed)return;
    fallbackUsed=true;
    audio.src=ogg;
    audio.load();
    // A source error may occur after a user-initiated start.
    if(window.RaceMusic?.playing)audio.play().catch(()=>{});
  });
  window.RaceMusic={
    playing:false,
    // Start silent playback inside the user's tap gesture so iOS permits playback
    // after the three-second countdown.
    prepare(){
      this.stop();
      this.playing=true;
      audio.volume=0;
      audio.play().catch(err=>console.warn('Race music unlock failed:',err));
    },
    start(){
      this.playing=true;
      try{audio.currentTime=0}catch{}
      audio.volume=.65;
      if(audio.paused)audio.play().catch(err=>console.warn('Race music playback failed:',err));
    },
    stop(){
      this.playing=false;
      audio.pause();
      try{audio.currentTime=0}catch{}
    }
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)window.RaceMusic.stop()});
  window.addEventListener('pagehide',()=>window.RaceMusic.stop());
})();
