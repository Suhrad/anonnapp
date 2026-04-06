import { useApiMutation } from "@/hooks/useApiMutation";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const ALLOWED_REACTIONS = ["👍", "😂", "🔥", "❤️", "🎯", "😮"];

interface ReactionBarProps {
  commentId: number;
  reactions: Record<string, string[]>;
  onReactionChange: (reactions: Record<string, string[]>) => void;
}

export default function ReactionBar({
  commentId,
  reactions,
  onReactionChange,
}: ReactionBarProps) {
  const { user } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  const reactMutation = useApiMutation<{ reactions: Record<string, string[]> }, { emoji: string }>({
    endpoint: `comments/${commentId}/react`,
    method: "POST",
  });

  const handleReact = (emoji: string) => {
    if (!user) return;
    setShowPicker(false);

    // Optimistic update
    const updated = { ...reactions };
    const voters = updated[emoji] ? [...updated[emoji]] : [];
    const idx = voters.indexOf(user.id);
    if (idx === -1) {
      voters.push(user.id);
    } else {
      voters.splice(idx, 1);
    }
    if (voters.length === 0) {
      delete updated[emoji];
    } else {
      updated[emoji] = voters;
    }
    onReactionChange(updated);

    reactMutation.mutate(
      { emoji },
      {
        onSuccess: (data) => {
          onReactionChange(data.reactions);
        },
        onError: () => {
          // Roll back on error
          onReactionChange(reactions);
        },
      }
    );
  };

  const existingEmojis = Object.keys(reactions).filter(
    (emoji) => reactions[emoji].length > 0
  );

  if (existingEmojis.length === 0 && !user) return null;

  return (
    <div className="px-9 py-2 flex items-center gap-1.5 flex-wrap relative">
      {/* Existing reaction pills */}
      {existingEmojis.map((emoji) => {
        const hasReacted = user ? reactions[emoji].includes(user.id) : false;
        return (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            disabled={!user || reactMutation.isPending}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors
              ${hasReacted
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-[#525252]/40 bg-[#1a1a1a] text-gray-400 hover:border-gray-500 hover:text-gray-300"
              } disabled:cursor-not-allowed`}
          >
            <span>{emoji}</span>
            <span>{reactions[emoji].length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      {user && (
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-[#525252]/40 bg-[#1a1a1a] text-gray-400 hover:border-gray-500 hover:text-gray-300 text-xs transition-colors"
            aria-label="Add reaction"
          >
            +
          </button>

          {showPicker && (
            <div className="absolute bottom-8 left-0 z-10 flex gap-1 p-1.5 bg-[#1a1a1a] border border-[#525252]/50 rounded-lg shadow-lg">
              {ALLOWED_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-base hover:scale-125 transition-transform p-0.5"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
