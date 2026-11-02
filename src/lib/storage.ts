import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export interface StorageProvider {
  save(key: string, data: Buffer): Promise<void>;
  remove(key: string): Promise<void>;
  getUrl(key: string): string;
}

class LocalStorage implements StorageProvider {
  readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }

  // جلوگیری از path traversal (مثلاً کلید "../../.env")
  private resolveKey(key: string): string {
    const fullPath = path.resolve(this.root, key);

    if (!fullPath.startsWith(this.root + path.sep)) {
      throw new Error("Invalid storage key");
    }

    return fullPath;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolveKey(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      // اگه فایل از قبل وجود نداشت مشکلی نیست
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

export const storage = new LocalStorage(process.env.UPLOAD_DIR ?? "uploads");