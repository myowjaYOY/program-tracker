declare module 'docxmarks' {
  function docxmarks(
    buffer: Buffer,
    replacements: Record<string, string | ((val: any) => any)>,
    fontSize?: number
  ): Promise<Buffer>;
  
  export default docxmarks;
}
