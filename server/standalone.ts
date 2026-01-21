import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "itsmyfavoriteworkplace@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.use(cors({
  origin: FRONTEND_URL.split(",").map(url => url.trim()),
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    clinicId?: number;
  }
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
}));

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  console.log(`[SESSION DEBUG] ${req.method} ${req.path}`, req.session);
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

const isClinicAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.clinicId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized - Clinic login required" });
};

app.get("/api/auth/user", (req, res) => {
  if (req.session.user) {
    res.json({
      id: req.session.user.id,
      email: req.session.user.email,
      role: req.session.user.role,
    });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  if (email === ADMIN_EMAIL && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    req.session.user = {
      id: "admin",
      email: email,
      role: "superuser",
    };
    return res.json({ 
      id: "admin", 
      email, 
      role: "superuser",
      message: "Login successful" 
    });
  }

  res.status(401).json({ message: "Invalid credentials" });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out" });
  });
});

app.get(api.slots.list.path, async (req, res) => {
  const ownerId = req.query.ownerId as string;
  const date = req.query.date as string;
  const slots = await storage.getSlots(ownerId, date);
  res.json(slots);
});

app.get(api.clinics.list.path, async (req, res) => {
  const clinics = await storage.getClinics();
  res.json(clinics);
});

app.post(api.clinics.create.path, isAuthenticated, async (req, res) => {
  try {
    const { name, address, username, password } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ message: "Name, username, and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const clinic = await storage.createClinic({
      name,
      address: address || null,
      username,
      passwordHash: hashedPassword,
    });
    const { passwordHash, ...clinicWithoutPassword } = clinic;
    res.status(201).json(clinicWithoutPassword);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    log(`Clinic creation error: ${(err as any).message}`);
    res.status(500).json({ message: "Failed to create clinic" });
  }
});

app.patch("/api/clinics/:id", isAuthenticated, async (req, res) => {
  const clinicId = parseInt(req.params.id);
  try {
    const updateData: any = { ...req.body };
    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }
    const clinic = await storage.updateClinic(clinicId, updateData);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }
    const { passwordHash, ...clinicWithoutPassword } = clinic;
    res.json(clinicWithoutPassword);
  } catch (err) {
    throw err;
  }
});

app.delete("/api/clinics/:id", isAuthenticated, async (req, res) => {
  const clinicId = parseInt(req.params.id);
  await storage.archiveClinic(clinicId);
  res.status(204).send();
});

app.post("/api/clinic/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  const clinic = await storage.getClinicByUsername(username);
  if (!clinic || !clinic.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, clinic.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.clinicId = clinic.id;
  
  const { passwordHash, ...clinicWithoutPassword } = clinic;
  res.json(clinicWithoutPassword);
});

app.post("/api/clinic/logout", (req, res) => {
  req.session.clinicId = undefined;
  res.json({ message: "Logged out" });
});

app.get("/api/clinic/me", isClinicAuthenticated, async (req, res) => {
  const clinic = await storage.getClinic(req.session.clinicId!);
  if (!clinic) {
    return res.status(404).json({ message: "Clinic not found" });
  }
  const { passwordHash, ...clinicWithoutPassword } = clinic;
  res.json(clinicWithoutPassword);
});

app.get("/api/clinic/bookings", isClinicAuthenticated, async (req, res) => {
  const clinic = await storage.getClinic(req.session.clinicId!);
  if (!clinic) {
    return res.status(404).json({ message: "Clinic not found" });
  }
  const bookings = await storage.getBookingsByClinicId(clinic.id);
  res.json(bookings);
});

app.delete("/api/clinic/bookings/:id", isClinicAuthenticated, async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const clinic = await storage.getClinic(req.session.clinicId!);
  if (!clinic) {
    return res.status(404).json({ message: "Clinic not found" });
  }
  
  const booking = await storage.getBookingById(bookingId);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const slot = await storage.getSlot(booking.slotId);
  if (!slot || (slot.clinicId !== clinic.id && slot.clinicName !== clinic.name)) {
    return res.status(403).json({ message: "Not authorized to cancel this booking" });
  }

  await storage.cancelBooking(bookingId);
  log(`[EMAIL] Booking cancelled notification would be sent to ${booking.customerEmail}`);
  
  res.json({ message: "Booking cancelled successfully" });
});

app.post("/api/public/bookings", async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, clinicId, clinicName, startTime, endTime } = req.body;

    if (!customerName || !customerPhone || !customerEmail || !clinicId || !startTime || !endTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const clinic = await storage.getClinic(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    const requestedStart = new Date(startTime);
    const existingBookings = await storage.countVerifiedBookingsForClinicTime(clinicId, clinic.name, requestedStart);
    
    const MAX_BOOKINGS_PER_SLOT = 3;
    if (existingBookings >= MAX_BOOKINGS_PER_SLOT) {
      return res.status(400).json({ message: "This time slot is fully booked. Please choose another time." });
    }

    const slot = await storage.createSlot({
      ownerId: null,
      startTime: requestedStart,
      endTime: new Date(endTime),
      clinicName: clinicName || clinic.name,
      clinicId: clinicId,
      isBooked: true,
    } as any);

    const booking = await storage.createPublicBooking({
      slotId: slot.id,
      customerName,
      customerPhone,
      customerEmail,
      verificationCode: null,
      verificationExpiresAt: null,
      verificationStatus: 'verified',
    });

    log(`[EMAIL] Booking confirmation would be sent to ${customerEmail}`);
    log(`[EMAIL] Details: ${customerName} booked at ${clinic.name} for ${requestedStart.toLocaleString()}`);

    res.status(201).json({ 
      message: "Booking confirmed!", 
      booking: { ...booking, slot } 
    });
  } catch (err: any) {
    log(`Public booking error: ${err.message}`);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${message}`);
  res.status(status).json({ message });
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  log(`Backend API serving on port ${port}`);
});
