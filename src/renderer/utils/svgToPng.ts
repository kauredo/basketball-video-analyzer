// Rasterises a standalone SVG string to PNG bytes at `scale` times its size.
export const svgToPng = (svg: string, width: number, height: number, scale = 2): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No 2D canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error("PNG encoding failed"));
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)), reject);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not draw the chart"));
    };
    img.src = url;
  });
