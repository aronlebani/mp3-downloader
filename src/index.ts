import * as fs from 'fs';
import axios from 'axios';

type Seconds = number;
type Byte = number;

export class Mp3Downloader {

  private url: string;
  private bytes: Uint8Array;
  private frequency: number;
  private bitRate: number;
  private startByte: Byte;
  private endByte: Byte;

  private bitRateTable: Array<number> = 
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  
  private frequencyTable: Array<number> = [44100, 48000, 32000];

  constructor(url: string) {
    this.url = url;
  }

  public async download(start: Seconds, end: Seconds, out: string): Promise<void> {
    await this.getHeader();
    this.getFrequency();
    this.getBitRate();
    this.getStartByte(start);
    this.getEndByte(end);
    await this.sendRequest(this.url, out);
  }

  private async sendRequest(url: string, out: string): Promise<void> {
    const writer = fs.createWriteStream(out);

    const response = await axios.get(url, {
      headers: {
        'Range': `bytes=${this.startByte}-${this.endByte}`,
      },
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async getHeader(): Promise<void> {
    const response = await axios.get(this.url, {
      headers: {
        'Range': 'bytes=0-3',
      },
      responseType: 'arraybuffer',
    });

    this.bytes = Uint8Array.from(response.data);
  }

  private getStartByte(startTime: Seconds): void {
    this.startByte = this.bitRate * 1024 * startTime / 8;
  }

  private getEndByte(endTime: Seconds): void {
    this.endByte = this.bitRate * 1024 * endTime / 8;
  }

  private getBitRate(): void {
    this.bitRate = this.bitRateTable[this.bytes[2] >> 4];
  }

  private getFrequency(): void {
    this.frequency = this.frequencyTable[this.bytes[2] & 0xF >> 2];
  }
}