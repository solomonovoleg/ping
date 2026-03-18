declare module "simple-peer" {
  interface Options {
    initiator?: boolean;
    stream?: MediaStream;
    streams?: MediaStream[];
    trickle?: boolean;
    config?: RTCConfiguration;
    offerOptions?: RTCOfferOptions;
    answerOptions?: RTCAnswerOptions;
  }

  interface SignalData {
    type?: string;
    sdp?: string;
    candidate?: string;
    sdpMLineIndex?: number;
    sdpMid?: string;
  }

  export default class SimplePeer {
    constructor(options?: Options);
    on(event: "signal", cb: (data: SignalData) => void): this;
    on(event: "stream", cb: (stream: MediaStream) => void): this;
    on(event: "connect", cb: () => void): this;
    on(event: "close", cb: () => void): this;
    on(event: "error", cb: (err: Error) => void): this;
    signal(data: SignalData): void;
    destroy(): void;
    destroyed: boolean;
  }
}
