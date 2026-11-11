"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { announceSuccess, announceError, announceInfo } from "@/components/LiveRegion";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
// import { useUser } from "@/lib/use-user"; // Assuming you have a user hook
import { useActor } from "@/lib/use-actor";

export default function MatchRoom() {
	const params = useParams<{ id: string }>();
	const matchId = params.id;
	const [state, setState] = useState<any>(null);
	const [currentFlashcard, setCurrentFlashcard] = useState<any>(null);
	const [answer, setAnswer] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const lastStats = useRef<{ p0: number; p1: number } | null>(null);
	const { actorId } = useActor(); // Get current user

	async function loadMatch() {
		try {
			const res = await fetch(`/api/matches/${matchId}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to load match");
			
			setState(data.match);
			
			// Load current flashcard if match is active
			if (data.match && data.match.status === "active" && data.match.flashcardIds.length > 0) {
				await loadCurrentFlashcard(data.match);
			}

			// Announce score changes
			if (data.match) {
				const p0 = data.match.players[0].score;
				const p1 = data.match.players[1].score;
				
				if (lastStats.current) {
					if (p0 !== lastStats.current.p0 || p1 !== lastStats.current.p1) {
						announceSuccess(`Scores updated. Player 1: ${p0}. Player 2: ${p1}.`);
					}
				}
				
				if (data.match.status === "finished") {
					if (data.match.winnerUserId) {
						// Identify if current user is the winner
						const isWinner = actorId === data.match.winnerUserId;
						announceSuccess(`Match finished. ${isWinner ? "You won!" : "Opponent won!"}`);
					} else {
						announceSuccess("Match finished. It's a tie!");
					}
				}
				
				lastStats.current = { p0, p1 };
			}
		} catch (error: any) {
			setError(error.message);
			announceError("Error loading match");
		} finally {
			setIsLoading(false);
		}
	}

	async function loadCurrentFlashcard(matchData: any) {
		try {
			const currentCardId = matchData.flashcardIds[matchData.currentCardIndex];
			const res = await fetch(`/api/flashcards/${currentCardId}`);
			const data = await res.json();
			if (res.ok) {
				setCurrentFlashcard(data.flashcard);
			}
		} catch (error) {
			console.error("Failed to load flashcard:", error);
		}
	}

useEffect(() => {
  let channel: any = null;
  let isMounted = true;

  const initializeChannel = async () => {
    try {
      // Load match initially
      await loadMatch();

      // Create and subscribe to channel
      const supabase = getSupabaseBrowserClient();
      channel = supabase.channel(`match:${matchId}`, {
        config: {
          broadcast: { self: true, ack: true }
        }
      });

      channel
        .on('broadcast', { event: 'match:update' }, (payload: any) => {
          console.log(' Real-time update received:', payload);
          if (isMounted) {
            // Force reload the match data
            loadMatch();
          }
        })
        .on('error', (error: any) => {
          console.error('Channel error:', error);
        })
        .subscribe((status: string) => {
          console.log('Channel status:', status);
        });

    } catch (error) {
      console.error('Failed to initialize match channel:', error);
    }
  };

  initializeChannel();

  return () => {
    isMounted = false;
    if (channel) {
      const supabase = getSupabaseBrowserClient();
      supabase.removeChannel(channel);
    }
  };
}, [matchId]);
	// In your match room component

// Then use them like this:
async function submitAnswer() {
  setError(null);
  try {
    const res = await fetch(`/api/matches/${matchId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    
    if (data.correct) {
      if (data.scored) {
        announceSuccess("Correct answer! +1 point");
      } else {
        announceInfo("Correct but someone answered first");
      }
    } else {
      announceError("Incorrect answer");
    }
    
    setAnswer("");
  } catch (e: any) {
    setError(e.message);
    announceError("Error submitting answer");
  }
}

	// Helper functions to identify players
	const getPlayerPosition = (userId: string) => {
		if (!state) return -1;
		return state.players.findIndex((player: any) => player.userId === userId);
	};

	const isCurrentUser = (userId: string) => {
  return actorId === userId;
};

	if (isLoading) return <div className="p-6">Loading match...</div>;
	if (!state) return <div className="p-6">Match not found</div>;

	const isFinished = state.status === "finished";
	const currentUserPosition = actorId ? getPlayerPosition(actorId) : -1;

	return (
		<div className="max-w-2xl mx-auto p-6 space-y-6">
			<h1 className="text-2xl font-bold">Match Room</h1>
			
			{/* Current Question */}
			{currentFlashcard && !isFinished && (
				<div className="border rounded p-4 bg-white shadow-sm">
					<h2 className="text-lg font-semibold mb-2">Current Question:</h2>
					<p className="text-xl">{currentFlashcard.question}</p>
				</div>
			)}

			{/* Answer Input */}
			{!isFinished && (
				<div className="space-y-2">
					<label htmlFor="answer" className="block text-sm font-medium">
						Your Answer:
					</label>
					<div className="flex items-center gap-2">
						<input
							id="answer"
							value={answer}
							onChange={(e) => setAnswer(e.target.value)}
							placeholder="Type your answer..."
							className="flex-1 border px-3 py-2 rounded disabled:opacity-50"
							disabled={isFinished}
							onKeyPress={(e) => e.key === "Enter" && submitAnswer()}
						/>
						<button
							onClick={submitAnswer}
							className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
							disabled={isFinished || !answer.trim()}
						>
							Submit
						</button>
					</div>
				</div>
			)}

			{error && <p className="text-red-600 text-sm p-2 bg-red-50 rounded">{error}</p>}

			{/* Match Status */}
			<div className="border rounded p-4 bg-gray-50">
				<div className="flex justify-between items-center mb-3">
					<span className="font-semibold">Status: {state.status.toUpperCase()}</span>
					<span className="text-sm text-gray-600">
						Card {state.currentCardIndex + 1} of {state.flashcardIds.length}
					</span>
				</div>

				{/* Players */}
				<div className="space-y-2">
					{state.players.map((player: any, index: number) => (
						<div
							key={player.userId}
							className={`p-2 rounded ${
								isCurrentUser(player.userId) ? 'bg-blue-100 border-blue-200' : 'bg-white'
							} border`}
						>
							<div className="flex justify-between items-center">
								<span>
									{isCurrentUser(player.userId) ? "You" : `Player ${index + 1}`}
									{state.winnerUserId === player.userId && " 🏆"}
								</span>
								<span className="font-bold">{player.score} points</span>
							</div>
							{isCurrentUser(player.userId) && (
								<span className="text-xs text-blue-600">(That's you!)</span>
							)}
						</div>
					))}
				</div>

				{isFinished && (
					<div className="mt-3 p-2 bg-yellow-100 border-yellow-200 rounded">
						{state.winnerUserId ? (
							<p className="font-semibold">
								{isCurrentUser(state.winnerUserId) ? "You won!" : "Opponent won!"}
							</p>
						) : (
							<p className="font-semibold">It's a tie!</p>
						)}
					</div>
				)}

				<p className="text-sm text-gray-600 mt-3">
					First correct answer scores. Race to answer!
				</p>
			</div>
		</div>
	);
}