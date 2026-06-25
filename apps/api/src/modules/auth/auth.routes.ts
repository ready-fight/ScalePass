import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);

      const existingUser = await prisma.user.findUnique({
        where: {
          email: body.email
        }
      });

      if (existingUser) {
        return reply.code(409).send({
          error: "Email already registered"
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      const user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      const token = app.jwt.sign({
        sub: user.id,
        role: user.role
      });

      return reply.code(201).send({
        user,
        token
      });
    });

  app.post("/auth/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: {
          email: body.email
        }
      });

      if (!user) {
        return reply.code(401).send({
          error: "Invalid email or password"
        });
      }

      const isValidPassword = await bcrypt.compare(
        body.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        return reply.code(401).send({
          error: "Invalid email or password"
        });
      }

      const token = app.jwt.sign({
        sub: user.id,
        role: user.role
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      };
    });
}