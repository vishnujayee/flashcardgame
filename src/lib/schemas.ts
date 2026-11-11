import { z } from "zod";

// Add to your existing schemas
export const UserSchema = z.object({
  _id: z.string().optional(),
  supabaseUserId: z.string(), // Links to Supabase auth user
  email: z.string().email(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  // Add any additional user fields you need
  username: z.string().optional(),
  preferences: z.object({}).optional().default({}),
  idAdmin: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;
// export type UserProfile = z.infer<typeof UserProfileSchema>;

export const FlashcardSchema = z.object({
	_id: z.string().optional(),
	question: z.string().min(1),
	answer: z.string().min(1),
	createdBy: z.string(),
	createdAt: z.date().default(() => new Date()),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const MatchPlayerSchema = z.object({
	userId: z.string(),
	score: z.number().int().nonnegative().default(0),
});

export const MatchStateSchema = z.object({
	_id: z.string().optional(),
	status: z.enum(["waiting", "active", "finished"]).default("waiting"),
	players: z.tuple([MatchPlayerSchema, MatchPlayerSchema]),
	flashcardIds: z.array(z.string()).min(1),
	// Deprecated: turn-based removed; retained for backward compatibility
	currentTurnIndex: z.number().int().nonnegative().default(0).optional(),
	currentCardIndex: z.number().int().nonnegative().default(0),
	winnerUserId: z.string().optional(),
	createdAt: z.date().default(() => new Date()),
	updatedAt: z.date().default(() => new Date()),
});
export type MatchState = z.infer<typeof MatchStateSchema>;

// Queue Schema for matchmaking
export const QueueEntrySchema = z.object({
	_id: z.string().optional(),
	userId: z.string(),
	ipHash: z.string().optional(), // Hashed IP for same IP blocking
	createdAt: z.date().default(() => new Date()),
});
export type QueueEntry = z.infer<typeof QueueEntrySchema>;

// Rate limit schema
export const RateLimitSchema = z.object({
	_id: z.string().optional(),
	key: z.string(),
	count: z.number().int().nonnegative().default(1),
	createdAt: z.date().default(() => new Date()),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

export const CreateFlashcardInput = FlashcardSchema.pick({ question: true, answer: true });
export const StartMatchmakingInput = z.object({ count: z.number().int().positive().max(50).default(10) });
export const SubmitAnswerInput = z.object({ matchId: z.string(), answer: z.string().min(1) });