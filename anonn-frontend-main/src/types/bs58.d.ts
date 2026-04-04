declare module "bs58" {
  export function encode(data: Uint8Array): string;
  export function decode(data: string): Uint8Array;
}
