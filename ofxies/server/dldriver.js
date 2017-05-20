export type Driver = {
  realm(): string;
  download(ua: Nightmare, creds: Creds,
           start: number, now: Date): Promise<History>;
  toOFX(data: History): Promise<Array<STMTTRN>>
}

type Creds = {
  login(): Promise<string>;
  password(): Promise<string>;
}

type Nightmare = any; // TODO
