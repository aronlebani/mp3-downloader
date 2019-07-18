import * as fs from 'fs';
import axios from 'axios';

type Seconds = number;
type Mp3Header = Uint8Array;

export class Mp3Downloader {

  private url: string;

  private bitRateTable: Array<number> = 
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  
  private frequencyTable: Array<number> = [44100, 48000, 32000];

  private modeTable: Array<number> = [2, 2, 2, 1];

  private samplesPerFrame: number = 1152;

  constructor(url: string) {
    this.url = url;
  }

  public async download(start: Seconds, end: Seconds, path: string): Promise<void> {
    // Poll 1 kb of data from 1 Mb into the file -> skip over potential metadata at the start of 
    // the file
    const bytes: Uint8Array = await this.downloadBytes(1048576, 1049600);
    const [header, offset]: [Mp3Header, number] = this.findFirstHeader(bytes);
    const bitRate: number = this.getBitRate(header);
    const frequency: number = this.getFrequency(header);
    const startByte: number = this.getStartByte(start, bitRate, frequency, offset);
    const endByte: number = this.getEndByte(end, bitRate, frequency, offset);
    await this.streamBytes(this.url, path, startByte, endByte);
  }

  private async streamBytes(url: string,
                            out: string,
                            from: number,
                            to: number): Promise<void> {
    const writer = fs.createWriteStream(out);

    const response = await axios.get(url, {
      headers: {
        'Range': `bytes=${from}-${to}`,
      },
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async downloadBytes(from: number, to: number): Promise<Uint8Array> {
    const response = await axios.get(this.url, {
      headers: {
        'Range': `bytes=${from}-${to}`,
      },
      responseType: 'arraybuffer',
    });

    return Uint8Array.from(response.data);
  }

  private async getFileSizeBytes(): Promise<number> {
    const response = await axios.head(this.url);
    return Number(response.headers['content-length']);
  }

  private getStartByte(startTime: Seconds,
                       bitRate: number,
                       frequency: number,
                       offset: number): number {
    return Math.floor(
      startTime * ( bitRate * 1024 ) * ( 1 - this.samplesPerFrame / frequency ) / 8 + offset
    );
  }

  private getEndByte(endTime: Seconds,
                     bitRate: number,
                     frequency: number,
                     offset: number): number {
    return Math.ceil(
      endTime * ( bitRate * 1024 ) * ( 1 - this.samplesPerFrame / frequency ) / 8 + offset
    );
  }

  private getBitRate(bytes: Mp3Header): number {
    return this.bitRateTable[bytes[2] >> 4];
  }

  private getFrequency(bytes: Mp3Header): number {
    return this.frequencyTable[bytes[2] & 0xF >> 2];
  }

  private getChannels(bytes: Mp3Header): number {
    return this.modeTable[bytes[3] >> 6];
  }

  private findFirstHeader(bytes: Uint8Array): [Mp3Header, number] {
    for (let i: number = 0; i < bytes.length; i++) {
      const header: Mp3Header = bytes.slice(i, i + 4);
      if (this.verifyHeader(header)) {
        return [header, i];
      }
    }
    throw new Error('Header not found or not a valid mp3 file');
  }

  private verifyHeader(bytes: Mp3Header): boolean {
    return this.verifySyncWord(bytes) && this.verifyVersion(bytes) && this.verifyLayer(bytes);
  }

  private verifySyncWord(bytes: Mp3Header): boolean {
    return ( bytes[0] == 0xFF ) && ( bytes[1] >> 4 == 0xF );
  }

  private verifyVersion(bytes: Mp3Header): boolean {
    return ( ( bytes[1] & 0x8 ) >> 3 ) == 0x1;
  }

  private verifyLayer(bytes: Mp3Header): boolean {
    return ( ( bytes[1] & 0x6 ) >> 1 ) == 0x1;
  }
}