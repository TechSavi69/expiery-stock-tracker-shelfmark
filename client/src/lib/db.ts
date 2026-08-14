import Dexie, { type Table } from "dexie";

export type InventoryItem = {
  id?: number;
  name: string;
  barcode?: string;
  category: string;
  quantity: number;
  expiryDate: string;
  alertThreshold: number;
  createdAt: string;
  updatedAt: string;
};

class ShelfmarkDatabase extends Dexie {
  items!: Table<InventoryItem, number>;

  constructor() {
    super("shelfmark-inventory");
    this.version(1).stores({
      items: "++id, name, category, expiryDate, updatedAt",
    });
    this.version(2).stores({
      items: "++id, name, barcode, category, expiryDate, updatedAt",
    });
  }
}

export const db = new ShelfmarkDatabase();
