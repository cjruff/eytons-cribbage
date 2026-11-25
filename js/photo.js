// Player photos from the camera, the photo library or a file (same picker as Moe's Dominoes).
// Code: (c) Corey J Ruff
//
// On a phone the picker offers Take Photo, Photo Library and Choose File; on a computer
// it opens the file browser.  The picture is shrunk in the browser to the table's portrait
// shape (280 x 360, cropped from the centre and a little high to keep faces) and kept as
// a ~30-50 KB JPEG, so saved data stays small however big the original was.
//
// Phone fix (from Moe's Dominoes): the file picker is attached to the page and kept
// referenced while the camera / library is open (iPhone Safari can drop a detached picker
// and never report the photo), both "change" and "input" are listened for, and decoding
// tries two methods (createImageBitmap, which honours camera rotation, then an <img>).

export const PHOTO_W = 280, PHOTO_H = 360;
let picker = null;                       // kept referenced while the camera / library is open

/** Ask for a photo.  Resolves to a JPEG data URL, or null if nothing was picked. */
export function pickPhoto() {
  return new Promise((resolve) => {
    if (picker) picker.remove();
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.cssText = "position:fixed;left:-1000px;top:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(inp);
    picker = inp;
    let done = false;
    const finish = (v) => { if (done) return; done = true; inp.remove(); if (picker === inp) picker = null; resolve(v); };
    const onPicked = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return finish(null);
      showBusy(true);
      try { finish(await shrink(f)); } catch {
        alert("Sorry, that picture couldn't be read. Try a JPEG or PNG, or pick it from your photo library.");
        finish(null);
      } finally { showBusy(false); }
    };
    inp.addEventListener("change", onPicked);
    inp.addEventListener("input", onPicked);
    inp.click();
  });
}

function showBusy(on) {
  let b = document.getElementById("photoBusy");
  if (on && !b) {
    b = document.createElement("div");
    b.id = "photoBusy";
    b.textContent = "Adding photo…";
    b.style.cssText = "position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:5000;padding:12px 20px;border-radius:24px;background:rgba(0,0,0,.8);color:#f6f0e1;font-weight:700";
    document.body.appendChild(b);
  } else if (!on && b) b.remove();
}

/** Decode with createImageBitmap (respects camera rotation) or fall back to an <img>. */
async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back */ }
  }
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
}

/** Crop to the portrait shape and encode as JPEG (exported for tests). */
export async function shrink(file) {
  const img = await decode(file);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("empty image");
  const want = PHOTO_W / PHOTO_H;
  let sw = w, sh = h;
  if (w / h > want) sw = h * want; else sh = w / want;
  const sx = (w - sw) / 2;
  const sy = Math.max(0, (h - sh) * 0.3);             // tall photos: keep the top (faces)
  const c = document.createElement("canvas");
  c.width = PHOTO_W; c.height = PHOTO_H;
  const g = c.getContext("2d");
  g.fillStyle = "#efe6d2";                             // transparent PNGs get a parchment background
  g.fillRect(0, 0, PHOTO_W, PHOTO_H);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
  if (img.close) img.close();
  const out = c.toDataURL("image/jpeg", 0.8);
  if (!out.startsWith("data:image/jpeg")) throw new Error("encode failed");
  return out;
}
