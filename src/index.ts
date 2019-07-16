import * as fs from 'fs';
import axios from 'axios';

type Seconds = number;
type Mp3Header = Uint8Array;

export class Mp3Downloader {

  private url: string;

  private bitRateTable: Array<number> = 
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  
  private frequencyTable: Array<number> = [44100, 48000, 32000];

  constructor(url: string) {
    this.url = url;
  }

  public async download(start: Seconds, end: Seconds, path: string): Promise<void> {
    const bytes = await this.getFirstNBytes(16);
    const header: Mp3Header = this.findFirstHeader(bytes);
    const bitRate = this.getBitRate(header);
    const startByte: number = this.getStartByte(start, bitRate);
    const endByte: number = this.getEndByte(end, bitRate);
    await this.sendRequest(this.url, path, startByte, endByte);
  }

  private async sendRequest(url: string, out: string, startByte: number, endByte: number): Promise<void> {
    const writer = fs.createWriteStream(out);

    const response = await axios.get(url, {
      headers: {
        'Range': `bytes=${startByte}-${endByte}`,
      },
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async getFirstNBytes(n: number): Promise<Uint8Array> {
    const response = await axios.get(this.url, {
      headers: {
        'Range': `bytes=0-${n}`,
      },
      responseType: 'arraybuffer',
    });

    return Uint8Array.from(response.data);
  }

  private getStartByte(startTime: Seconds, bitRate: number): number {
    return bitRate * 1024 * startTime / 8;
  }

  private getEndByte(endTime: Seconds, bitRate: number): number {
    return bitRate * 1024 * endTime / 8;
  }

  private getBitRate(bytes): number {
    return this.bitRateTable[bytes[2] >> 4];
  }

  private getFrequency(bytes): number {
    return  this.frequencyTable[bytes[2] & 0xF >> 2];
  }

  private findFirstHeader(bytes): Mp3Header {
    for (let i: number = 0; i < bytes.length; i++) {
      const header: Mp3Header = bytes.slice(i, i + 4);
      if (this.verifyHeader(header)) {
        return header;
      }
    }
    throw new Error('Header not found');
  }

  private verifyHeader(bytes: Mp3Header): boolean {
    return this.verifySyncWord(bytes) && this.verifyVersion(bytes) && this.verifyLayer(bytes);
  }

  private verifySyncWord(bytes: Mp3Header): boolean {
    return bytes[0] == 0xFF && bytes[1] >> 4 == 0xF;
  }

  private verifyVersion(bytes: Mp3Header): boolean {
    return ( bytes[1] & 0x8 >> 3 ) == 0x1;
  }

  private verifyLayer(bytes: Mp3Header): boolean {
    return ( bytes[1] & 0x6 >> 1 ) == 0x1;
  }
}