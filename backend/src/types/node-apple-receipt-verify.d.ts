declare module 'node-apple-receipt-verify' {
  export function config(options: any): void;
  export function validate(receipt: any): Promise<any>;
}
