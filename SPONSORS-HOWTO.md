# How to Update Sponsors

This guide explains how to add, edit, or remove sponsors from the Mississippi Sports App sponsor feed — **no coding required**.

---

## Where the File Lives

The sponsor data is in: **`public/sponsors.json`**

After every change, Cloudflare Pages automatically rebuilds and deploys the site. The updated feed will be live at:

👉 **https://mississippisportsapp.com/sponsors.json**

---

## Editing via GitHub (Web Browser)

1. Go to your repository on GitHub.
2. Navigate to **`public/sponsors.json`**.
3. Click the **pencil icon** (✏️) in the top-right of the file to edit.
4. Make your changes (see examples below).
5. Scroll down, type a short description like "Added new sponsor" in the commit message box.
6. Click **"Commit changes"**.
7. Cloudflare Pages will automatically rebuild and deploy — usually within 1–2 minutes.

---

## Sponsor Schema

Each sponsor entry looks like this:

```json
{
  "id": "unique-slug",
  "name": "Sponsor Name",
  "imageUrl": "https://mississippisportsapp.com/sponsors/sponsor-image.jpg",
  "tapUrl": "https://example.com/",
  "tagline": "Optional short text",
  "active": true,
  "sortOrder": 1
}
```

| Field       | Required | Description                                                      |
|-------------|----------|------------------------------------------------------------------|
| `id`        | ✅       | A unique slug (lowercase, hyphens, no spaces). Example: `joes-pizza` |
| `name`      | ✅       | Display name shown in the app                                     |
| `imageUrl`  | ✅       | Full HTTPS URL to the sponsor banner/logo                        |
| `tapUrl`    | ✅       | Full HTTPS URL — where the app goes when tapped                  |
| `tagline`   | ❌       | Short description (shows below the name)                         |
| `active`    | ✅       | `true` to show, `false` to hide without deleting                 |
| `sortOrder` | ✅       | Number controlling display order (1 = first, 2 = second, etc.)   |

---

## Common Tasks

### Add a New Sponsor

1. Upload the sponsor's banner image to **`public/sponsors/`** on GitHub (drag & drop works).
2. Open **`public/sponsors.json`** for editing.
3. Add a new entry **inside the `"sponsors"` array**, separated by a comma from the previous entry:

```json
{
  "id": "new-sponsor",
  "name": "New Sponsor Name",
  "imageUrl": "https://mississippisportsapp.com/sponsors/new-sponsor.jpg",
  "tapUrl": "https://newsponsor.com/",
  "tagline": "Their catchphrase",
  "active": true,
  "sortOrder": 4
}
```

> **⚠️ Important:** Make sure there's a comma after the `}` of the previous sponsor entry, but **no comma** after the last entry in the array.

### Hide a Sponsor (Without Deleting)

Change `"active": true` to `"active": false`. The app will skip it.

### Change Display Order

Update the `sortOrder` numbers. Lower numbers appear first.

### Upload a New Sponsor Image

1. In GitHub, navigate to **`public/sponsors/`**.
2. Click **"Add file" → "Upload files"**.
3. Drag & drop the image (JPG or PNG, ideally 1200×400px or similar banner ratio).
4. Use a simple filename like `sponsor-name.jpg` (lowercase, hyphens, no spaces).
5. Commit the upload.
6. Use `https://mississippisportsapp.com/sponsors/sponsor-name.jpg` as the `imageUrl`.

---

## Troubleshooting

| Problem                          | Fix                                                                 |
|----------------------------------|---------------------------------------------------------------------|
| App shows old sponsors           | Wait 1–2 minutes for deploy; the JSON caches for 60 seconds max     |
| Sponsor not appearing            | Check `"active": true` and that the JSON has no syntax errors        |
| Image not loading                | Verify the image filename matches `imageUrl` exactly (case-sensitive)|
| JSON syntax error after editing  | Paste your JSON into [jsonlint.com](https://jsonlint.com) to find the error |
