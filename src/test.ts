import { Mp3Downloader } from './index';

(async () => {
  const urls: Array<string> = [
    'http://mpegmedia.abc.net.au/news/audio/podcast/thesignal/tsg-2019-06-26-episode314-mars-life.mp3',
    'https://cdn.simplecast.com/audio/f43520/f4352096-d805-4926-a3c4-d39b725616a3/d0f4154f-feb3-46ee-a09a-5f12ebe8b6fd/equity_7_5_clara_tc.mp3?aid=rss_feed',
    'http://traffic.libsyn.com/cowenconvos/CWT-061-SamAltman-podcast-v1.mp3?dest-id=850607',
  ];

  for (let i: number = 0; i < urls.length; i++) {
    console.log(urls[i])
    const mp3Downloader: Mp3Downloader = new Mp3Downloader(urls[i]);
    await mp3Downloader.download(360, 375, `./test_${i}.mp3`);  
  }
})();