"use client";

import { useState, useRef, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Send, X } from "lucide-react";
import { trackEvent } from "@/lib/pendo";

interface FeedbackButtonsProps {
  responseId: string;
  sessionId?: string;
}

type FeedbackState = "idle" | "submitting" | "submitted" | "error";

export function FeedbackButtons({ responseId, sessionId }: FeedbackButtonsProps) {
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [selectedVote, setSelectedVote] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showComment && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showComment]);

  async function submitFeedback(helpful: boolean, feedbackComment?: string) {
    setFeedbackState("submitting");
    setSelectedVote(helpful);

    trackEvent('feedback_submitted', {
      helpful,
      has_comment: !!feedbackComment,
      response_id: responseId,
    });

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_id: responseId,
          helpful,
          comment: feedbackComment || undefined,
          session_id: sessionId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Feedback submission failed");
      }

      setFeedbackState("submitted");
    } catch {
      setFeedbackState("error");
      setTimeout(() => setFeedbackState("idle"), 2000);
    }
  }

  function handleVote(helpful: boolean) {
    if (feedbackState === "submitted" || feedbackState === "submitting") return;

    setSelectedVote(helpful);
    setShowComment(true);
  }

  function handleSubmitWithComment() {
    if (selectedVote === null) return;
    submitFeedback(selectedVote, comment.trim());
  }

  function handleSkipComment() {
    if (selectedVote === null) return;
    submitFeedback(selectedVote);
  }

  if (feedbackState === "submitted") {
    return (
      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-light animate-msg-in">
        <span className="text-[12px] text-success font-medium">
          Thanks for your feedback!
        </span>
      </div>
    );
  }

  if (feedbackState === "error") {
    return (
      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-light">
        <span className="text-[12px] text-warning font-medium">
          Could not submit feedback. Try again.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2.5 border-t border-border-light">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text-muted">Helpful?</span>
        <button
          onClick={() => handleVote(true)}
          disabled={feedbackState === "submitting"}
          className={`p-1.5 rounded-md transition-all ${
            selectedVote === true
              ? "bg-success/10 text-success"
              : "text-text-muted hover:text-success hover:bg-success/5"
          } disabled:opacity-50`}
          aria-label="Thumbs up"
          data-pendo="feedback-thumbs-up"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={feedbackState === "submitting"}
          className={`p-1.5 rounded-md transition-all ${
            selectedVote === false
              ? "bg-warning/10 text-warning"
              : "text-text-muted hover:text-warning hover:bg-warning/5"
          } disabled:opacity-50`}
          aria-label="Thumbs down"
          data-pendo="feedback-thumbs-down"
        >
          <ThumbsDown size={14} />
        </button>
      </div>

      {showComment && feedbackState !== "submitting" && (
        <div className="mt-2 animate-msg-in">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: tell us more..."
              maxLength={2000}
              rows={2}
              className="flex-1 text-[12.5px] text-text-primary bg-surface border border-border-default rounded-lg px-3 py-2 resize-none placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={handleSubmitWithComment}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-[12px] font-medium rounded-md hover:bg-primary-light transition-all"
            >
              <Send size={11} />
              Submit
            </button>
            <button
              onClick={handleSkipComment}
              className="flex items-center gap-1 px-3 py-1.5 text-text-muted text-[12px] font-medium hover:text-text-secondary transition-colors"
            >
              <X size={11} />
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
