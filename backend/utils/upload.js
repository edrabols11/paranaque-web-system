require("dotenv").config();

async function uploadBase64ToSupabase(base64Data, bucket, path) {
  if (!base64Data) return "";

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Clean, "base64");

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": "image/jpeg",
      "Content-Length": buffer.length.toString(),
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("Upload error:", errorText);
    throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

module.exports = { uploadBase64ToSupabase };
