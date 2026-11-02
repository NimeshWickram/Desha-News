import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const posts = sqliteTable('posts', {
 id: text('id').primaryKey(), slug: text('slug').notNull().unique(), data: text('data').notNull(), status: text('status').notNull(),
 version: integer('version').notNull().default(1), updatedAt: text('updated_at').notNull(),
 authorId: text('author_id').notNull(),
});
export const settings = sqliteTable('settings', {id:text('id').primaryKey(),data:text('data').notNull()});
