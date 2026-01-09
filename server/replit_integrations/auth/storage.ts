import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, count } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if this user already exists
    const existingUser = await this.getUser(userData.id!);
    
    // If user already exists, update their info
    if (existingUser) {
      // Check if this email should be superuser (designated admin email)
      const isSuperuserEmail = userData.email === 'itsmyfavoriteworkplace@gmail.com';
      
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Upgrade to superuser if they have the designated email
          ...(isSuperuserEmail ? { role: 'superuser' } : {}),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }
    
    // Check if this email should be superuser
    const isSuperuserEmail = userData.email === 'itsmyfavoriteworkplace@gmail.com';
    
    // For new users, check if they should be the first superuser or have the designated email
    const [{ userCount }] = await db.select({ userCount: count() }).from(users);
    const isFirstUser = userCount === 0;
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: (isFirstUser || isSuperuserEmail) ? 'superuser' : 'customer',
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
