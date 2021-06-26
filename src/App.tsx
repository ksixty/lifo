import { useState, FormEvent, useEffect, useRef } from "react";
// import * as reader from "./reader";
import "./styles.css";

// : DOUBLE 2 + ; ====> ["2", "+"] ===> ([2, +] => docol())

type Cell = number;
type Token = string;

type Mode = "immediate" | "compile";
type Word = { isImmediate: boolean; fn: () => void };

type UiState = {
  output: string;
  error: string;
  mode: Mode;
  bgColor: string;
  skipWord: boolean;
};

function createStack<StackType>() {
  const stack: StackType[] = [];
  const isEmpty = () => {
    return stack.length === 0;
  };
  const push = (val: StackType) => {
    stack.push(val);
  };
  const pop = (): StackType | undefined => {
    return stack.pop();
  };
  const peek = () => {
    return stack[stack.length - 1];
  };

  return {
    stack,
    push,
    pop,
    peek,
    isEmpty
  };
}

export default function App() {
  const [list, setList] = useState<[string, string][]>([]);
  const [value, setValue] = useState<string>("");

  const stateRef = useRef<UiState>({
    output: "",
    error: "",
    mode: "immediate",
    bgColor: "#310",
    skipWord: false
  });
  const state = stateRef.current;

  const stackRef = useRef(createStack<Cell>());
  const defStackRef = useRef(createStack<Token>());
  const stack = stackRef.current;
  const defStack = defStackRef.current;

  const wordsRef = useRef<{
    [key: string]: Word;
  }>({});

  const forthEval = (token: string) => {
    const word = wordsRef.current[token];
    const mode = state.mode;
    if (state.skipWord) {
      state.skipWord = false;
      return;
    }
    if (word) {
      if (word.isImmediate || mode === "immediate") {
        word.fn();
      } else {
        defStack.push(token);
      }
    } else if (!isNaN(Number(token))) {
      if (mode === "immediate") {
        stack.push(Number(token));
      } else {
        defStack.push(token);
      }
    } else {
      if (mode === "immediate") {
        state.error = "unknown word";
      } else {
        defStack.push(token);
      }
    }
  };

  const bg = () => {
    const a = stack.pop();
    if (typeof a !== "undefined") {
      state.bgColor = `#${a.toString(16).padStart(6, "0")}`;
    }
  };

  const branch = () => {
    state.skipWord = true;
  };

  const zbranch = () => {
    const a = stack.pop();
    if (typeof a !== "undefined") {
      state.skipWord = a !== 0;
      console.log(state.skipWord);
    }
  };

  const docol = (tokens: string[]) => {
    tokens.forEach((token) => {
      forthEval(token);
    });
  };

  const add = () => {
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a !== "undefined" && typeof b !== "undefined") {
      stack.push(a + b);
    } else {
      state.error = "stack underflow";
    }
  };

  const dots = () => {
    state.output = stack.stack.reduce(
      (output, value) => `${output} ${value}`,
      `<${stack.stack.length}> `
    );
  };

  const dup = () => {
    const a = stack.pop();
    if (typeof a !== "undefined") {
      stack.push(a);
      stack.push(a);
    } else {
      state.error = "stack underflow";
    }
  };

  const pop = () => {
    const a = stack.pop();
    if (typeof a !== "undefined") {
      state.output = `${a}`;
    } else {
      state.error = "stack underflow";
    }
  };

  const showWords = () => {
    state.output = Object.keys(wordsRef).join(" ");
  };

  const colon = () => {
    document.body.style.backgroundColor = "#013";
    defStackRef.current = createStack<Token>();
    state.mode = "compile";
  };

  const semicolon = () => {
    document.body.style.backgroundColor = "#310";
    const def = defStack.stack.slice(1, defStack.stack.length);
    const name = defStack.stack[0];
    console.log("semicolon", def, name);
    wordsRef.current = {
      ...wordsRef.current,
      [name]: {
        isImmediate: false,
        fn: () => docol(def)
      }
    };
    state.mode = "immediate";
    defStackRef.current = createStack<Token>();
  };

  if (Object.keys(wordsRef.current).length === 0) {
    wordsRef.current = {
      "+": { isImmediate: false, fn: add },
      ".s": { isImmediate: false, fn: dots },
      ":": { isImmediate: true, fn: colon },
      ";": { isImmediate: true, fn: semicolon },
      ".": { isImmediate: false, fn: pop },
      words: { isImmediate: false, fn: showWords },
      dup: { isImmediate: false, fn: dup },
      bg: { isImmediate: false, fn: bg },
      branch: { isImmediate: true, fn: branch },
      "0branch": { isImmediate: true, fn: zbranch }
    };
  }

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

  const readLine = (line: string) => {
    state.output = "";
    state.error = "";
    const tokens = line.split(/[ ,]+/);
    tokens.forEach((token) => {
      forthEval(token);
    });
  };

  const handleLine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim() === "") {
      return;
    }
    readLine(value.trim());
    let result = "";

    if (state.output !== "") result += state.output;
    if (state.error !== "") {
      result += " ? " + state.error;
    } else {
      result += " ok";
    }

    setList([...list, [value, result]]);
    setValue("");
  };

  useEffect(() => {
    document.body.scrollTop = document.body.scrollHeight;
  }, [list]);

  document.body.style.backgroundColor = stateRef.current.bgColor;

  return (
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
  );
}
