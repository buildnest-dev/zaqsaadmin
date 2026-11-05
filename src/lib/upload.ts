// Unsigned Cloudinary upload: the preset (created once in the Cloudinary dashboard) limits what
// can be uploaded, so no secret key is needed in the browser.
export const CLOUD_NAME = "qiam8gyn";
export const UPLOAD_PRESET = "zaqsa_unsigned";

export async function uploadImage(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB.");
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);
  body.append("folder", "zaqsa");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body,
  });
  const data = (await response.json()) as { secure_url?: string; error?: { message: string } };
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "Upload failed. Check the Cloudinary upload preset.");
  }
  // f_auto,q_auto lets Cloudinary serve a small modern format to each visitor.
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_1200/");
}
