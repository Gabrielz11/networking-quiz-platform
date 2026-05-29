/**
 * Hook para consumir o endpoint de explicação em modo streaming SSE.
 * Lê chunks do ReadableStream e acumula o texto progressivamente no estado.
 */
"use client";

import { useState, useCallback, useRef } from "react";

export type StreamingState = "idle" | "streaming" | "done" | "error";

interface UseStreamingExplanationReturn {
    streamedText: string;
    streamingState: StreamingState;
    startStream: (payload: {
        sessionId: string;
        questionId: string;
        studentAnswerIndex: number;
    }) => Promise<void>;
    reset: () => void;
}

export function useStreamingExplanation(): UseStreamingExplanationReturn {
    const [streamedText, setStreamedText] = useState("");
    const [streamingState, setStreamingState] = useState<StreamingState>("idle");
    const abortRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setStreamedText("");
        setStreamingState("idle");
    }, []);

    const startStream = useCallback(async (payload: {
        sessionId: string;
        questionId: string;
        studentAnswerIndex: number;
    }) => {
        // Cancela um stream anterior se ainda estiver ativo
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setStreamedText("");
        setStreamingState("streaming");

        try {
            const res = await fetch("/api/explain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            // Fallback: a rota retornou JSON de erro em vez de stream
            const contentType = res.headers.get("Content-Type") || "";
            if (!res.ok || contentType.includes("application/json")) {
                const data = await res.json().catch(() => ({}));
                setStreamedText(data.explanation || "Erro ao gerar explicação.");
                setStreamingState("done");
                return;
            }

            if (!res.body) {
                throw new Error("Resposta sem corpo de stream.");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setStreamedText(prev => prev + chunk);
            }

            setStreamingState("done");
        } catch (err: any) {
            if (err.name === "AbortError") return; // cancelamento intencional
            console.error("[useStreamingExplanation] Erro no stream:", err);
            setStreamingState("error");
        }
    }, []);

    return { streamedText, streamingState, startStream, reset };
}
