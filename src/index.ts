import * as fs from 'fs';
import axios from 'axios';

type Seconds = number;

export class Mp3Downloader {

  private url: string;
  private samplesPerFrame: number = 1152;

  constructor(url: string) {
    this.url = url;
  }

  public async getMp3Data(): Promise<Mp3Header> {
    // Poll 1 kb of data from 1 Mb into the file -> skip over potential metadata at the start of 
    // the file
    // const bytes: Uint8Array = await this.downloadBytes(1048576, 1049600);
    const bytes: Uint8Array = await this.downloadBytes(0, 1048576);
    const mp3Header: Mp3Header = new Mp3Header(bytes);
    return mp3Header;
  }

  public async download(start: Seconds,
                        end: Seconds,
                        path: string,
                        data: Mp3Header): Promise<void> {
    const startByte: number = this.getStartByte(start, data.bitRate, data.frequency, data.offset);
    const endByte: number = this.getEndByte(end, data.bitRate, data.frequency, data.offset);
    await this.streamBytes(this.url, path, startByte, endByte);
  }

  public async getFileSizeBytes(): Promise<number> {
    const response = await axios.head(this.url);
    return Number(response.headers['content-length']);
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
}

class InvalidHeaderError extends Error {
  constructor(message?: string) {
    let msg: string = message || 'Not a valid Mp3 file';
    super(msg);
    Error.captureStackTrace(this, InvalidHeaderError);
  }
}

export class Mp3Header {

  private _syncWord: number;
  private _version: number;
  private _layer: number;
  private _protectionBit: number;
  private _bitRate: number;
  private _frequency: number;
  private _paddingBit: number;
  private _mode: number;
  private _offset: number;

  private bitRateTable: Array<number> = 
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  private frequencyTable: Array<number> = [44100, 48000, 32000];
  private modeTable: Array<number> = [2, 2, 2, 1];
  private protectionBitTable: Array<number> = [0, 1];
  private paddingBitTable: Array<number> = [0, 1];

  constructor(bytes: Uint8Array) {
    this.findFirstHeader(bytes);
  }

  get syncWord(): number {
    return this._syncWord;
  }

  get version(): number {
    return this._version;
  }

  get later(): number {
    return this._layer;
  }

  get protectionBit(): number {
    return this._protectionBit;
  }

  get bitRate(): number {
    return this._bitRate;
  }

  get frequency(): number {
    return this._frequency;
  }

  get paddingBit(): number {
    return this._paddingBit;
  }

  get mode(): number {
    return this._mode;
  }

  get offset(): number {
    return this._offset;
  }

  private findFirstHeader(bytes: Uint8Array): void {
    for (let i: number = 0; i < bytes.length; i++) {
      const candidate: Uint8Array = bytes.slice(i, i + 4);
      try {
        this.getHeader(candidate);
        this._offset = i;
        return;
      } catch (err) {
        if (err instanceof InvalidHeaderError) {
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new Error('Header not found');
  }

  private getHeader(bytes: Uint8Array): void {
    this._syncWord = this.getSyncWord(bytes);
    this._version = this.getVersion(bytes);
    this._layer = this.getLayer(bytes);
    this._protectionBit = this.getProtectionBit(bytes);
    this._bitRate = this.getBitRate(bytes);
    this._frequency = this.getFrequency(bytes);
    this._paddingBit = this.getPaddingBit(bytes);
    this._mode = this.getMode(bytes);
  }

  private getSyncWord(bytes: Uint8Array): number {
    const syncWord: number = ( 16 * bytes[0] ) + ( bytes[1] >> 4 );
    if (syncWord !== 0xFFF) {
      throw new InvalidHeaderError('Invalid sync word');
    }
    return syncWord;
  }

  private getVersion(bytes: Uint8Array): number {
    const version: number = ( bytes[1] & 0x8 ) >> 3 ;
    if (version !== 0x1) {
      throw new InvalidHeaderError('Invalid version');
    }
    return version;
  }

  private getLayer(bytes: Uint8Array): number {
    const layer: number = ( bytes[1] & 0x6 ) >> 1;
    if (layer !==  0x1) {
      throw new InvalidHeaderError('Invalid layer');
    }
    return layer;
  }

  private getProtectionBit(bytes: Uint8Array): number {
    const code: number = bytes[1] & 0x1;
    if (code > this.protectionBitTable.length) {
      throw new InvalidHeaderError('Invalid protection bit');
    }
    return this.protectionBitTable[code];
  }

  private getBitRate(bytes: Uint8Array): number {
    const code: number = bytes[2] >> 4;
    if (code >= this.bitRateTable.length) {
      throw new InvalidHeaderError('Invalid bitrate');
    }
    return this.bitRateTable[code];
  }

  private getFrequency(bytes: Uint8Array): number {
    const code: number = ( bytes[2] & 0xF ) >> 2;
    if (code >= this.frequencyTable.length) {
      throw new InvalidHeaderError('Invalid frequency');
    }
    return this.frequencyTable[code];
  }

  private getPaddingBit(bytes: Uint8Array): number {
    const code: number = ( bytes[2] & 0x2 ) >> 1;
    if (code >= this.paddingBitTable.length) {
      throw new InvalidHeaderError('Invalid padding bit');
    }
    return this.paddingBitTable[code];
  }

  private getMode(bytes: Uint8Array): number {
    const code: number = bytes[3] >> 6;
    if (code >= this.modeTable.length) {
      throw new InvalidHeaderError('Invalid mode');
    }
    return this.modeTable[code];
  }
}