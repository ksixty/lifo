import { useState, FormEvent, useEffect, useRef } from "react";
// import * as reader from "./reader";
import "./styles.css";

type Cell = number;
type Token = string;
type Mode = "immediate" | "compile";
type Word = {
  name: string;
  isHidden: boolean;
  isImmediate: boolean;
  fn: () => void;
};

type Stack<StackT> = {
  stack: StackT[];
  push: (value: StackT) => number;
  pop: () => StackT | undefined;
  peek: (address?: number) => StackT | undefined;
  poke: (address: number, value: StackT) => void;
  isEmpty: () => boolean;
};

type State = {
  input: string;
  output: string;
  error: string;
  ip: any; // instruction pointer
  wp: number; // word pointer
  mode: Mode;
  params: Stack<Cell>;
  data: Stack<Cell>;
  ret: Stack<Cell>;
  bgColor: string;
};

type Dictionary = {
  words: Word[];
  find: (name: Token) => Word | undefined;
  create: (word: Word) => void;
  add: (
    name: string,
    isHidden: boolean,
    isImmediate: boolean,
    fn: () => void
  ) => void;
};

function createStack<StackT>(): Stack<StackT> {
  const stack: StackT[] = [];
  const isEmpty = () => {
    return stack.length === 0;
  };
  const push = (value: StackT) => {
    stack.push(value);
    return stack.length - 1;
  };
  const pop = (): StackT | undefined => {
    return stack.pop();
  };
  const peek = (address?: number): StackT | undefined => {
    address = address || stack.length - 1;
    return stack[address];
  };
  const poke = (address: number, value: StackT) => {
    stack[address] = value;
  };
  return {
    stack,
    push,
    pop,
    peek,
    poke,
    isEmpty,
  };
}

function createDictionary(): Dictionary {
  const words: Word[] = [];
  const find = (name: Token): Word | undefined => {
    const results = words.filter(
      (word) => word.name === name && !word.isHidden
    );
    return results[results.length - 1];
  };
  const create = (word: Word) => {
    words.push(word);
  };
  const add = (
    name: string,
    isHidden: boolean,
    isImmediate: boolean,
    fn: () => void
  ) => {
    create({
      name: name,
      isHidden: isHidden,
      isImmediate: isImmediate,
      fn: fn,
    });
  };
  return {
    words,
    find,
    create,
    add,
  };
}

export default function App() {
  const [list, setList] = useState<[string, string][]>([]);
  const [value, setValue] = useState<string>("");

  const stateRef = useRef<State>({
    input: "",
    output: "",
    error: "",
    ip: undefined,
    wp: 0,
    mode: "immediate",
    params: createStack<Cell>(),
    data: createStack<Cell>(),
    ret: createStack<Cell>(),
    bgColor: "#310",
  });
  const wordsRef = useRef<Dictionary>(createDictionary());

  const state = stateRef.current;
  const dict = wordsRef.current;

  // built-in functions
  const next = () => {
    state.wp++;
    const wordCode = state.data.stack[state.wp];
    const word = dict.words[wordCode];
    if (typeof word === "undefined") {
      exit();
      // state.error = "? memory error";
      return;
    } else {
      word.fn();
    }
  };
  const exit = () => {
    const nextAddress = state.ret.pop();
    if (state.ret.stack.length == 0) {
      return; // idk why this works
    }
    if (typeof nextAddress !== "undefined") {
      console.log("stack", state.ret.stack, "will return to", nextAddress);
      state.wp = nextAddress;
      next();
    }
    return;
  };
  const docol = (address: number) => {
    state.ret.push(address);
    state.wp = address;
    console.log("doing word at", address, "stack", state.ret.stack);
    next();
  };
  const toImmediate = () => {
    state.mode = "immediate";
    next();
  };
  const toCompile = () => {
    state.mode = "compile";
    next();
  };
  const hide = () => {
    dict.words[dict.words.length - 1].isHidden = true;
    next();
  };
  const reveal = () => {
    dict.words[dict.words.length - 1].isHidden = false;
    next();
  };
  const colon = () => {
    // this function has two passes
    if (state.input !== "" && dict.words[dict.words.length - 1].name == "") {
      // this is the second pass
      // we were called directly from reader to write a word's name FIXME
      dict.words[dict.words.length - 1].name = state.input;
      state.ip = undefined; // release control to interpreter
    } else {
      // this is the first pass
      if (state.mode === "compile") {
        state.error = "? colon inside colon is too colony";
        return;
      }
      // create the word. we'll get its name the next time
      state.wp = state.data.stack.length;
      let wordPtr = state.wp;
      dict.add("", true, false, () => docol(wordPtr));
      state.ip = colon; // next input will be captured by colon() not by interpreter
      toCompile();
      exit();
    }
  };
  const semicolon = () => {
    if (state.mode === "immediate") {
      state.error = "? nothing to compile";
    }
    state.data.poke(state.wp++, 0); // write EXIT;
    reveal();
    toImmediate();
    exit();
  };
  const branch = () => {
    state.wp++;
    next();
  };
  const zeroBranch = () => {
    if (state.params.pop() === 0) branch();
    next();
  };
  const lit = () => {
    // treats next data value as a literal number and pushes it on params stack
    const value = state.data.peek(++state.wp);
    if (typeof value !== "undefined") {
      state.params.push(value);
    } else {
      state.error = "? memory error";
    }
    next();
  };
  const dup = () => {
    const a = state.params.peek();
    if (typeof a !== "undefined") {
      state.params.push(a);
    } else {
      state.error = "? stack underflow";
    }
    next();
  };
  const add = () => {
    const a = state.params.pop();
    const b = state.params.pop();
    if (typeof a !== "undefined" && typeof b !== "undefined") {
      state.params.push(a + b);
    } else {
      state.error = "? stack underflow";
    }
    next();
  };
  const dots = () => {
    state.output = state.params.stack.reduce(
      (output, value) => `${output} ${value}`,
      `<${state.params.stack.length}> `
    );
    next();
  };
  const showWords = () => {
    state.output = dict.words.map((word) => word.name).join(" ");
    next();
  };

  // dict initialization
  if (dict.words.length === 0) {
    dict.add("exit", false, false, exit);
    dict.add("docol", true, false, exit);
    dict.add("lit", false, false, lit);
    dict.add("[", false, true, toImmediate);
    dict.add("]", false, false, toCompile);
    dict.add("hide", false, true, hide);
    dict.add("reveal", false, false, reveal);
    dict.add(":", false, true, colon);
    dict.add(";", false, true, semicolon);
    dict.add(".s", false, false, dots);
    dict.add("+", false, false, add);
    dict.add("dup", false, false, dup);
  }

  const interpret = () => {
    if (typeof state.ip !== "undefined") {
      // a dirty hack for passing the input to another function
      state.ip();
      return;
    }

    const token = state.input; // read a word
    state.input = "";

    // a word is either a defined word or a number literal
    let knownWord = dict.find(token) || dict.words[2];
    let numValue = NaN;
    if (knownWord.isImmediate) {
      knownWord.fn(); // execute the immediate word right away
      return;
    }
    if (knownWord.name === "lit" && token !== "lit") {
      // if it is a literal, let's parse it
      numValue = Number(token);
      if (isNaN(numValue)) {
        state.error = "? undefined word"; // FIXME
        return;
      }
    }

    if (state.mode === "immediate" || knownWord.isImmediate) {
      if (!isNaN(numValue)) {
        state.params.push(numValue);
      } else {
        knownWord.fn();
      }
    } else {
      state.data.poke(state.wp++, dict.words.indexOf(knownWord));
      if (!isNaN(numValue)) {
        state.data.poke(state.wp++, numValue);
      }
    }
    next();
  };

  const renderList = () => {
    return list.map(([inp, out], index) => {
      return (
        <div className="historyItem" key={index}>
          <span className="inp">{inp}</span>&nbsp;
          <span className="out">{out}</span>
        </div>
      );
    });
  };

  const handleLine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const tokens = value.trim().split(/[ ,]+/);
    state.output = "";
    state.error = "";
    tokens.every((token) => {
      state.input = token;
      interpret();
      return state.error === "";
    });
    const result = `${state.output} ${state.error}`;

    setList([...list, [value, result]]);
    setValue("");
  };

  useEffect(() => {
    document.body.scrollTop = document.body.scrollHeight;
  }, [list]);

  document.body.style.backgroundColor = stateRef.current.bgColor;

  return (
    <div className="forth">
      <div className="state">
        <div>
          <div>
            <h3>Memory</h3> {state.data.stack.join(" ")}
          </div>
          <div>
            <h3>Parameters</h3> {state.params.stack.join(" ")}
          </div>
          <div>
            <h3>WP</h3> {state.wp}
          </div>
          <div>
            <h3>IP</h3> {state.ip ? `${state.ip.name}` : "interpret"}
          </div>
          <div>
            <h3>Mode</h3> {state.mode}
          </div>
        </div>
        <div>
          <div>
            <h3>Words</h3>{" "}
            {dict.words
              .map((w, i) => (w.isHidden ? "" : `(${i})${w.name}`))
              .join(" ")}
          </div>
          <div>
            <h3>Return Stack</h3>{" "}
            {state.ret.stack.map((x) => dict.words[x].name).join(" → ")}
          </div>
        </div>
      </div>
      <div id="repl">
        {renderList()}

        <form onSubmit={handleLine} autoComplete="off">
          <input
            type="text"
            // autoFocus={true}
            className="replInput"
            value={value}
            spellCheck={false}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
          <input style={{ display: "none" }} autoComplete="off" type="submit" />
        </form>
      </div>
    </div>
  );
}
