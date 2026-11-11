import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getMongoClient, getMongoDbName, ensureIndexes } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActorIdOrGuest } from "@/lib/guest-session";

export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = await getSupabaseServerClient();
		const { data: { user } } = await supabase.auth.getUser();
		const actorId = await getActorIdOrGuest(user?.id ?? null);
		
		const payload = await req.json();
		if (!payload || typeof payload.answer !== "string") {
			return NextResponse.json({ error: "Bad Request" }, { status: 400 });
		}
		
		const answer = payload.answer.trim();
		if (answer.length === 0 || answer.length > 500) {
			return NextResponse.json({ error: "Bad Request" }, { status: 400 });
		}

		await ensureIndexes();
		const client = await getMongoClient();
		const db = client.db(getMongoDbName());
		const matches = db.collection("matches");
		const flashcards = db.collection("flashcards");
		const matchId = params.id;

		if (!ObjectId.isValid(matchId)) {
			return NextResponse.json({ error: "Bad Request" }, { status: 400 });
		}

		// Load current state and verify user is a participant
		const match = await matches.findOne({ 
			_id: new ObjectId(matchId), 
			"players.userId": actorId 
		});
		
		if (!match) {
			return NextResponse.json({ error: "Not Found" }, { status: 404 });
		}
		
		if (match.status !== "active") {
			return NextResponse.json({ error: "Match not active" }, { status: 400 });
		}

		// Get current flashcard
		const cardId = match.flashcardIds[match.currentCardIndex];
		const card = await flashcards.findOne({ _id: new ObjectId(cardId) });
		if (!card) {
			return NextResponse.json({ error: "Card not found" }, { status: 500 });
		}

		// Check if answer is correct
		const isCorrect = String(card.answer).trim().toLowerCase() === answer.toLowerCase();
		
		if (!isCorrect) {
			// Immediately return for incorrect answers - no point scoring
			return NextResponse.json({ correct: false, finished: false });
		}

		// For correct answers: Try to be the first to score!
		const playerIndex = match.players.findIndex((p: any) => p.userId === actorId);
		if (playerIndex === -1) {
			return NextResponse.json({ error: "Not a player" }, { status: 403 });
		}

		// Use atomic operation to ensure only the first correct answer gets the point
		const result = await matches.findOneAndUpdate(
			{
				_id: new ObjectId(matchId),
				status: "active",
				currentCardIndex: match.currentCardIndex,
				// Ensure this card hasn't been answered yet by checking scores haven't changed
				[`players.${playerIndex}.score`]: match.players[playerIndex].score
			},
			{
				$inc: { [`players.${playerIndex}.score`]: 1 },
				$set: { 
					updatedAt: new Date(),
					// Move to next card immediately when someone gets it right
					currentCardIndex: match.currentCardIndex + 1
				}
			},
			{ 
				returnDocument: 'after',
				// This ensures we're the first to update this document for this card
				sort: { _id: 1 } 
			}
		);

		if (!result) {
			// Someone else already answered correctly and moved to next card
			return NextResponse.json({ 
				correct: true, 
				finished: false, 
				alreadyScored: true,
				message: "Correct but someone answered first" 
			});
		}

		const updatedMatch = result;
		const isFinished = updatedMatch.currentCardIndex >= updatedMatch.flashcardIds.length;

		// If match is finished, determine winner and update status
		if (isFinished) {
			const scores = updatedMatch.players.map((p: any) => p.score);
			const maxScore = Math.max(...scores);
			const winners = updatedMatch.players.filter((p: any) => p.score === maxScore);
			
			let winnerUserId = undefined;
			if (winners.length === 1) {
				winnerUserId = winners[0].userId;
			}

			await matches.updateOne(
				{ _id: new ObjectId(matchId) },
				{
					$set: {
						status: "finished",
						...(winnerUserId && { winnerUserId }),
						updatedAt: new Date()
					}
				}
			);
		}

		// Broadcast update to all subscribers
		const admin = getSupabaseAdminClient();
		await admin.channel(`match:${matchId}`).send({ 
			type: "broadcast", 
			event: "match:update", 
			payload: { 
				matchId, 
				isCorrect: true, 
				isFinished,
				scoringPlayer: actorId,
				currentCardIndex: updatedMatch.currentCardIndex
			} 
		});

		return NextResponse.json({ 
			correct: true, 
			finished: isFinished,
			scored: true,
			message: "Correct answer! +1 point" 
		});

	} catch (error: any) {
		console.error("Error submitting answer:", error);
		return NextResponse.json(
			{ error: "Internal server error", details: error.message },
			{ status: 500 }
		);
	}
}