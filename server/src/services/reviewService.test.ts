import { describe, expect, it } from 'vitest';
import { REVIEW_SYSTEM_INSTRUCTION } from '../prompts/reviewPrompt';
import { chunksOf, createFakeLlm } from '../testing/testApp';
import { reviewResume, reviewResumeStream } from './reviewService';

const request = { resumeText: 'Meu currículo', jobDescription: 'Vaga X' };

describe('reviewResume', () => {
  it('sends the system instruction and the built prompt, and returns the model text', async () => {
    const llm = createFakeLlm({ generate: () => Promise.resolve('resposta') });

    await expect(reviewResume(request, llm)).resolves.toBe('resposta');

    expect(llm.generateCalls).toHaveLength(1);
    expect(llm.generateCalls[0]?.systemInstruction).toBe(REVIEW_SYSTEM_INSTRUCTION);
    expect(llm.generateCalls[0]?.prompt).toContain('Meu currículo');
    expect(llm.generateCalls[0]?.prompt).toContain('Vaga X');
    expect(llm.generateCalls[0]?.signal).toBeUndefined();
  });

  it('propagates errors from the model client', async () => {
    const llm = createFakeLlm({ generate: () => Promise.reject(new Error('falhou')) });

    await expect(reviewResume(request, llm)).rejects.toThrow('falhou');
  });
});

describe('reviewResumeStream', () => {
  it('yields the chunks and forwards the abort signal', async () => {
    const llm = createFakeLlm({ generateStream: () => chunksOf('a', 'b', 'c') });
    const controller = new AbortController();

    const received: string[] = [];

    for await (const chunk of reviewResumeStream(request, llm, controller.signal)) {
      received.push(chunk);
    }

    expect(received).toEqual(['a', 'b', 'c']);
    expect(llm.streamCalls[0]?.signal).toBe(controller.signal);
    expect(llm.streamCalls[0]?.systemInstruction).toBe(REVIEW_SYSTEM_INSTRUCTION);
  });
});