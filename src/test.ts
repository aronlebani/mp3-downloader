import { Mp3Downloader } from './index';

(async () => {
  const url: string = 'http://mpegmedia.abc.net.au/news/audio/podcast/thesignal/tsg-2019-06-26-episode314-mars-life.mp3';

  const mp3Downloader: Mp3Downloader = new Mp3Downloader(url);

  await mp3Downloader.download(0, 30, './test.mp3');
})();