import { SseParser } from './sse-parser';

describe('SseParser', () => {
  it('parses a complete message', () => {
    const parser = new SseParser();

    expect(parser.push('event: chunk\ndata: {"text":"Oi"}\n\n')).toEqual([
      { event: 'chunk', data: '{"text":"Oi"}' },
    ]);
  });

  it('uses "message" as the default event name', () => {
    const parser = new SseParser();

    expect(parser.push('data: ola\n\n')).toEqual([{ event: 'message', data: 'ola' }]);
  });

  it('parses several messages that arrive in one chunk', () => {
    const parser = new SseParser();

    const messages = parser.push('event: chunk\ndata: a\n\nevent: done\ndata: {}\n\n');

    expect(messages.map((message) => message.event)).toEqual(['chunk', 'done']);
  });

  it('waits for the rest of a message split across chunks', () => {
    const parser = new SseParser();

    expect(parser.push('event: chu')).toEqual([]);
    expect(parser.push('nk\ndata: {"te')).toEqual([]);
    expect(parser.push('xt":"Oi"}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ event: 'chunk', data: '{"text":"Oi"}' }]);
  });

  it('handles CRLF line endings', () => {
    const parser = new SseParser();

    expect(parser.push('event: chunk\r\ndata: x\r\n\r\n')).toEqual([
      { event: 'chunk', data: 'x' },
    ]);
  });

  it('joins multiple data lines with a newline', () => {
    const parser = new SseParser();

    expect(parser.push('data: linha 1\ndata: linha 2\n\n')).toEqual([
      { event: 'message', data: 'linha 1\nlinha 2' },
    ]);
  });

  it('ignores comment lines (heartbeats)', () => {
    const parser = new SseParser();

    expect(parser.push(': keep-alive\n\n')).toEqual([]);
    expect(parser.push(': ping\nevent: done\ndata: {}\n\n')).toEqual([
      { event: 'done', data: '{}' },
    ]);
  });

  it('removes only one leading space after the colon', () => {
    const parser = new SseParser();

    expect(parser.push('data:  dois espaços\n\n')).toEqual([
      { event: 'message', data: ' dois espaços' },
    ]);
    expect(parser.push('data:sem espaço\n\n')).toEqual([
      { event: 'message', data: 'sem espaço' },
    ]);
  });

  it('does not leak the event name into the next message', () => {
    const parser = new SseParser();

    parser.push('event: chunk\ndata: a\n\n');

    expect(parser.push('data: b\n\n')).toEqual([{ event: 'message', data: 'b' }]);
  });

  it('does not emit a message without data', () => {
    const parser = new SseParser();

    expect(parser.push('event: chunk\n\n')).toEqual([]);
  });
});