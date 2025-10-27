
export function pickTrackByTime() {
  const h = new Date().getHours();
  return (h>=6 && h<18) ? 'assets/music/lofi_morning.mp3' : 'assets/music/lofi_evening.mp3';
}
