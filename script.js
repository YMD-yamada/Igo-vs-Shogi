
const board = document.getElementById("board");
const turnText = document.getElementById("turn");
const dialog = document.getElementById("dialog");

let turn = "igo";
let igoName = "";
let shogiName = "";
let igoStyle = "normal";
let shogiStyle = "normal";
let selected = null;
let placedPawn = false;

const boardState = Array(9).fill(null).map(() => Array(9).fill(null));

const shogiRow1 = ["香", "桂", "銀", "金", "王", "金", "銀", "桂", "香"];
const shogiRow2 = [null, "角", null, null, null, null, null, "飛", null];
const shogiRow3 = Array(9).fill("歩");

const igoRow1 = ["●", "●", "●", "●", "●", "●", "●", "●", "●"];
const igoRow2 = [null, "●", null, null, null, null, null, "●", null];
const igoRow3 = Array(9).fill("●");

function detectStyle(name) {
  name = name.toLowerCase();
  if (name.includes("丸") || name.includes("の助") || name.endsWith("郎")) return "samurai";
  if (name.endsWith("ちゃん") || name.includes("ぴょん")) return "cute";
  if (name.includes("様") || name.includes("魔") || name.includes("闇")) return "chuunibyou";
  if (name.endsWith("やで") || name.includes("たこ焼き") || name.includes("関西")) return "kansai";
  return "normal";
}

function startGame() {
  igoName = document.getElementById("igoName").value || "黒石丸";
  shogiName = document.getElementById("shogiName").value || "歩兵郎";
  igoStyle = detectStyle(igoName);
  shogiStyle = detectStyle(shogiName);

  // 初期配置：将棋
  for (let x = 0; x < 9; x++) {
    boardState[0][x] = { type: "shogi", label: shogiRow1[x] };
    if (shogiRow2[x]) boardState[1][x] = { type: "shogi", label: shogiRow2[x] };
    boardState[2][x] = { type: "shogi", label: shogiRow3[x] };
  }

  // 初期配置：囲碁
  for (let x = 0; x < 9; x++) {
    boardState[8][x] = "igo";
    if (igoRow2[x]) boardState[7][x] = "igo";
    boardState[6][x] = "igo";
  }

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  renderBoard();
  showDialog();
}

function switchTurn() {
  turn = turn === "igo" ? "shogi" : "igo";
  turnText.textContent = turn === "igo" ? "囲碁" : "将棋";
  selected = null;
  showDialog();
}

function getMessage(name, style) {
  const messages = {
    normal: [`${name}：「いざ勝負…！」`, `${name}：「この一手で…！」`],
    samurai: [`${name}：「これぞ武士の一手…！」`, `${name}：「拙者、参る！」`],
    cute: [`${name}：「ぽてっ♪ここにおくぴょん！」`, `${name}：「わーい、楽しいのら～！」`],
    chuunibyou: [`${name}：「闇の力が騒いでいる…」`, `${name}：「漆黒の戦略、今ここに！」`],
    kansai: [`${name}：「なんでやねん！そこ置くんかい！」`, `${name}：「こっちは負けへんで～！」`]
  };
  const list = messages[style] || messages["normal"];
  return list[Math.floor(Math.random() * list.length)];
}

function showDialog() {
  const name = turn === "igo" ? igoName : shogiName;
  const style = turn === "igo" ? igoStyle : shogiStyle;
  dialog.textContent = getMessage(name, style);
}

function renderBoard() {
  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      const value = boardState[y][x];
      if (value === "igo") {
        cell.textContent = "●";
        cell.classList.add("black");
      } else if (value?.type === "shogi") {
        cell.textContent = value.label;
        cell.classList.add("shogi");
      }

      cell.addEventListener("click", () => {
        if (turn === "igo") {
          if (!value) {
            boardState[y][x] = "igo";
            renderBoard();
            switchTurn();
          }
        } else if (turn === "shogi") {
          if (selected) {
            if (!value || value === "igo") {
              // 王が取られたら勝利
              if (value === "igo" && boardState[selected.y][selected.x].label === "王") {
                alert(`${shogiName} の敗北！${igoName} の勝利！`);
                return;
              }
              boardState[y][x] = boardState[selected.y][selected.x];
              boardState[selected.y][selected.x] = null;
              renderBoard();
              switchTurn();
            }
          } else if (value?.type === "shogi") {
            selected = { x, y };
          } else if (!value && !placedPawn) {
            boardState[y][x] = { type: "shogi", label: "歩" };
            placedPawn = true;
            renderBoard();
            switchTurn();
          }
        }
      });

      board.appendChild(cell);
    }
  }
}

function resetGame() {
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      boardState[y][x] = null;
    }
  }
  turn = "igo";
  placedPawn = false;
  startGame();
}
