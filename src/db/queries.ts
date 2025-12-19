import { db } from "./index"
import { wishes } from "./schema"
import { eq, desc } from "drizzle-orm"

export function listWishes(page: number = 1, limit: number = 5) {
  const offset = (page - 1) * limit
  return db.select().from(wishes).orderBy(desc(wishes.id)).limit(limit).offset(offset).all()
}

export function createWish(item: string, username: string) {
  const createdAt = Math.floor(Date.now() / 1000)

  const res = db.insert(wishes).values({
    item,
    fulfilled: 0,
    createdAt,
    username,
  }).run()

  return { id: Number(res.lastInsertRowid) }
}

export function fulfillWish(id: number) {
  const currentWish = db.select({ fulfilled: wishes.fulfilled }).from(wishes).where(eq(wishes.id, id)).get()

  if (!currentWish) {
    return { changes: 0 }
  }

  const newFulfilled = currentWish.fulfilled === 1 ? 0 : 1

  const res = db.update(wishes)
    .set({ fulfilled: newFulfilled })
    .where(eq(wishes.id, id))
    .run()

  return { changes: res.changes }
}

export function deleteWish(id: number) {
  const res = db.delete(wishes).where(eq(wishes.id, id)).run()
  return { changes: res.changes }
}
