"use strict";

const COLORS = ["red", "yellow", "green", "blue"];
const COLOR_LABELS = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue"
};
const PLAYER_NAMES = ["You", "CPU 1", "CPU 2", "CPU 3"];
const ACTION_LABELS = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "+2",
  wild: "Wild",
  wild4: "+4"
};
const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};
const CPU_TURN_DELAY_MS = 2200;

const state = {
  players: [],
  drawPile: [],
  discardPile: [],
  currentPlayer: 0,
  currentColor: "red",
  direction: 1,
  difficulty: "Easy",
  roundNumber: 1,
  roundHistory: [],
  gameStarted: false,
  roundOver: false,
  pendingWildIndex: null,
  saidUno: false,
  playFeed: [],
  cpuTimer: null,
  message: "Your Turn",
  lastPlayedId: null,
  audioContext: null,
  audioReady: false
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  startMatch();
}

function cacheElements() {
  els.gameBoard = document.getElementById("gameBoard");
  els.startPanel = document.getElementById("startPanel");
  els.startGameButton = document.getElementById("startGameButton");
  els.turnPill = document.getElementById("turnPill");
  els.colorPill = document.getElementById("colorPill");
  els.directionPill = document.getElementById("directionPill");
  els.roundPill = document.getElementById("roundPill");
  els.drawPileButton = document.getElementById("drawPileButton");
  els.drawPileCount = document.getElementById("drawPileCount");
  els.discardPile = document.getElementById("discardPile");
  els.playFeed = document.getElementById("playFeed");
  els.messageBox = document.getElementById("messageBox");
  els.humanHand = document.getElementById("humanHand");
  els.humanCardCount = document.getElementById("humanCardCount");
  els.drawCardButton = document.getElementById("drawCardButton");
  els.unoButton = document.getElementById("unoButton");
  els.newRoundButton = document.getElementById("newRoundButton");
  els.restartMatchButton = document.getElementById("restartMatchButton");
  els.modalNewRoundButton = document.getElementById("modalNewRoundButton");
  els.modalRestartButton = document.getElementById("modalRestartButton");
  els.colorModal = document.getElementById("colorModal");
  els.roundModal = document.getElementById("roundModal");
  els.winnerName = document.getElementById("winnerName");
  els.roundSummary = document.getElementById("roundSummary");
  els.playerPanels = [
    null,
    document.getElementById("player1Panel"),
    document.getElementById("player2Panel"),
    document.getElementById("player3Panel")
  ];
}

function bindEvents() {
  document.addEventListener("pointerdown", enableAudio, { once: true });
  els.startGameButton.addEventListener("click", startGame);
  els.drawCardButton.addEventListener("click", handleHumanDraw);
  els.drawPileButton.addEventListener("click", handleHumanDraw);
  els.unoButton.addEventListener("click", handleUno);
  els.newRoundButton.addEventListener("click", startRound);
  els.modalNewRoundButton.addEventListener("click", startRound);
  els.restartMatchButton.addEventListener("click", startMatch);
  els.modalRestartButton.addEventListener("click", startMatch);

  document.querySelectorAll(".level-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      state.message = `${state.difficulty} CPU`;
      render();
    });
  });

  document.querySelectorAll(".color-choice").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.pendingWildIndex === null) {
        closeColorModal();
        return;
      }
      const cardIndex = state.pendingWildIndex;
      closeColorModal();
      playCard(0, cardIndex, button.dataset.color);
    });
  });

  els.humanHand.addEventListener("click", (event) => {
    const cardButton = event.target.closest(".card");
    if (!cardButton) {
      return;
    }
    handleHumanCardClick(Number(cardButton.dataset.index));
  });
}

function startMatch() {
  clearCpuTimer();
  closeColorModal();
  closeRoundModal();
  state.roundHistory = [];
  state.roundNumber = 1;
  state.gameStarted = false;
  state.roundOver = false;
  state.pendingWildIndex = null;
  state.saidUno = false;
  state.playFeed = [];
  state.direction = 1;
  state.currentPlayer = 0;
  state.currentColor = "red";
  state.lastPlayedId = null;
  state.drawPile = [];
  state.discardPile = [];
  state.players = PLAYER_NAMES.map((name, index) => ({
    name,
    isHuman: index === 0,
    hand: [],
    lastMove: null
  }));
  state.message = "Press Start Game";
  render();
}

function startGame() {
  state.roundHistory = [];
  state.roundNumber = 1;
  startRound();
  playSound("start");
}

function startRound() {
  clearCpuTimer();
  closeColorModal();
  closeRoundModal();

  state.gameStarted = true;
  state.roundOver = false;
  state.pendingWildIndex = null;
  state.saidUno = false;
  state.playFeed = [];
  state.direction = 1;
  state.currentPlayer = 0;
  state.lastPlayedId = null;
  state.roundNumber = state.roundHistory.length + 1;

  state.players = PLAYER_NAMES.map((name, index) => ({
    name,
    isHuman: index === 0,
    hand: [],
    lastMove: null
  }));

  state.drawPile = shuffle(createDeck());
  state.discardPile = [];

  for (let cardCount = 0; cardCount < 7; cardCount += 1) {
    state.players.forEach((_, playerIndex) => {
      drawCards(playerIndex, 1);
    });
  }

  const starterIndex = state.drawPile.findIndex((card) => card.type === "number");
  const starter = state.drawPile.splice(starterIndex, 1)[0];
  state.discardPile.push(starter);
  state.currentColor = starter.color;
  addPlayFeed({
    player: "Start",
    text: `First card ${getCardLabel(starter)}`,
    card: starter,
    kind: "play"
  });
  state.message = getHumanDrawHint() || "Your Turn";

  render();
  playSound("deal");
}

function createDeck() {
  const deck = [];
  let id = 1;

  COLORS.forEach((color) => {
    deck.push(makeCard(id, color, "number", "0"));
    id += 1;

    for (let number = 1; number <= 9; number += 1) {
      for (let copy = 0; copy < 2; copy += 1) {
        deck.push(makeCard(id, color, "number", String(number)));
        id += 1;
      }
    }

    ["skip", "reverse", "draw2"].forEach((action) => {
      for (let copy = 0; copy < 2; copy += 1) {
        deck.push(makeCard(id, color, "action", action));
        id += 1;
      }
    });
  });

  for (let copy = 0; copy < 4; copy += 1) {
    deck.push(makeCard(id, "wild", "wild", "wild"));
    id += 1;
    deck.push(makeCard(id, "wild", "wild", "wild4"));
    id += 1;
  }

  return deck;
}

function makeCard(id, color, type, value) {
  return {
    id: `${id}`,
    color,
    type,
    value
  };
}

function shuffle(cards) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function handleHumanCardClick(cardIndex) {
  if (!state.gameStarted) {
    state.message = "Press Start Game.";
    playSound("invalid");
    render();
    return;
  }
  if (state.roundOver) {
    return;
  }
  if (state.currentPlayer !== 0) {
    state.message = "Wait please.";
    playSound("invalid");
    render();
    return;
  }

  const card = state.players[0].hand[cardIndex];
  if (!card || !isPlayable(card)) {
    state.message = "Try the same color or number.";
    playSound("invalid");
    render();
    return;
  }

  if (card.type === "wild") {
    state.pendingWildIndex = cardIndex;
    openColorModal();
    return;
  }

  playCard(0, cardIndex);
}

function handleHumanDraw() {
  if (!state.gameStarted) {
    state.message = "Press Start Game.";
    playSound("invalid");
    render();
    return;
  }
  if (state.roundOver) {
    return;
  }
  if (state.currentPlayer !== 0) {
    state.message = "Wait please.";
    playSound("invalid");
    render();
    return;
  }

  const drawnCount = drawCards(0, 1);
  if (drawnCount === 0) {
    state.message = "No cards now.";
    playSound("invalid");
    render();
    return;
  }
  state.saidUno = false;
  recordDraw(0, drawnCount);
  state.message = "You drew a card.";
  playSound("draw");
  state.currentPlayer = getNextPlayer(0);
  render();
  scheduleCpuTurn();
}

function handleUno() {
  if (!state.gameStarted) {
    state.message = "Press Start Game.";
    playSound("invalid");
    render();
    return;
  }
  if (state.roundOver) {
    return;
  }

  if (state.players[0].hand.length === 2) {
    state.saidUno = true;
    state.message = "UNO!";
    playSound("uno");
  } else {
    state.message = "Use UNO with two cards.";
    playSound("invalid");
  }
  render();
}

function playCard(playerIndex, cardIndex, chosenColor) {
  if (state.roundOver) {
    return;
  }

  const player = state.players[playerIndex];
  const card = player.hand[cardIndex];
  if (!card || !isPlayable(card)) {
    state.message = playerIndex === 0 ? "Pick a matching card." : `${player.name} waits.`;
    playSound("invalid");
    render();
    return;
  }

  const [playedCard] = player.hand.splice(cardIndex, 1);
  playedCard.playedColor = playedCard.type === "wild" ? chosenColor : playedCard.color;
  state.discardPile.push(playedCard);
  state.currentColor = playedCard.playedColor;
  state.lastPlayedId = playedCard.id;
  playSound(getSoundForCard(playedCard));

  if (playerIndex === 0 && player.hand.length !== 1) {
    state.saidUno = false;
  }

  if (player.hand.length === 1) {
    if (playerIndex === 0) {
      state.message = state.saidUno ? "UNO!" : "Say UNO next time!";
    } else {
      state.message = `${player.name} says UNO!`;
    }
  } else {
    state.message = `${player.name} played ${getCardLabel(playedCard)}.`;
  }

  recordCardPlay(playerIndex, playedCard);

  if (player.hand.length === 0) {
    finishRound(playerIndex);
    render();
    return;
  }

  applyCardEffect(playerIndex, playedCard);
  render();
  scheduleCpuTurn();
  playHumanTurnCue(playerIndex);
}

function applyCardEffect(playerIndex, card) {
  const actorName = state.players[playerIndex].name;
  const nextPlayer = getNextPlayer(playerIndex);

  if (card.value === "reverse") {
    state.direction *= -1;
    state.currentPlayer = getNextPlayer(playerIndex);
    state.message = `${actorName} played Reverse.`;
    return;
  }

  if (card.value === "skip") {
    state.currentPlayer = getNextPlayer(nextPlayer);
    state.message = `${actorName} played Skip. ${state.players[nextPlayer].name} skips.`;
    return;
  }

  if (card.value === "draw2") {
    drawCards(nextPlayer, 2);
    recordDraw(nextPlayer, 2);
    state.currentPlayer = getNextPlayer(nextPlayer);
    state.message = `${actorName} played +2. ${state.players[nextPlayer].name} draws 2.`;
    return;
  }

  if (card.value === "wild4") {
    drawCards(nextPlayer, 4);
    recordDraw(nextPlayer, 4);
    state.currentPlayer = getNextPlayer(nextPlayer);
    state.message = `${actorName} played +4. ${state.players[nextPlayer].name} draws 4.`;
    return;
  }

  if (card.value === "wild") {
    state.currentPlayer = nextPlayer;
    state.message = `${actorName} picked ${COLOR_LABELS[state.currentColor]}.`;
    return;
  }

  state.currentPlayer = nextPlayer;
}

function drawCards(playerIndex, count) {
  const hand = state.players[playerIndex].hand;
  let drawnCount = 0;

  for (let draw = 0; draw < count; draw += 1) {
    refillDrawPile();
    const card = state.drawPile.pop();
    if (!card) {
      return drawnCount;
    }
    delete card.playedColor;
    hand.push(card);
    drawnCount += 1;
  }

  return drawnCount;
}

function refillDrawPile() {
  if (state.drawPile.length > 0 || state.discardPile.length <= 1) {
    return;
  }

  const topCard = state.discardPile.pop();
  state.drawPile = shuffle(state.discardPile.map((card) => {
    delete card.playedColor;
    return card;
  }));
  state.discardPile = [topCard];
}

function finishRound(winnerIndex) {
  clearCpuTimer();
  state.roundOver = true;
  state.currentPlayer = winnerIndex;
  const winner = state.players[winnerIndex];
  const result = {
    round: state.roundNumber,
    winner: winner.name,
    counts: state.players.map((player) => player.hand.length)
  };
  state.roundHistory.push(result);
  state.message = winnerIndex === 0 ? "You Win!" : "Try Again";
  state.saidUno = false;
  playSound(winnerIndex === 0 ? "win" : "loss");
  showRoundModal(result);
}

function recordCardPlay(playerIndex, card) {
  const player = state.players[playerIndex];
  const cardCopy = cloneCardForUi(card);
  player.lastMove = {
    kind: "play",
    text: `Played ${getCardLabel(card)}`,
    card: cardCopy
  };
  addPlayFeed({
    player: player.name,
    text: `${player.name} played ${getCardLabel(card)}`,
    card: cardCopy,
    kind: "play"
  });
}

function recordDraw(playerIndex, count) {
  const player = state.players[playerIndex];
  if (!player || count <= 0) {
    return;
  }
  player.lastMove = {
    kind: "draw",
    text: `Drew ${count}`
  };
  addPlayFeed({
    player: player.name,
    text: `${player.name} drew ${count}`,
    kind: "draw"
  });
}

function addPlayFeed(entry) {
  state.playFeed.unshift(entry);
  state.playFeed = state.playFeed.slice(0, 5);
}

function cloneCardForUi(card) {
  return {
    id: card.id,
    color: card.color,
    type: card.type,
    value: card.value,
    playedColor: card.playedColor
  };
}

function isPlayable(card) {
  if (!card) {
    return false;
  }
  if (card.type === "wild") {
    return true;
  }

  const topCard = getTopCard();
  return Boolean(topCard) && (card.color === state.currentColor || card.value === topCard.value);
}

function getTopCard() {
  return state.discardPile[state.discardPile.length - 1];
}

function getNextPlayer(fromIndex) {
  return (fromIndex + state.direction + state.players.length) % state.players.length;
}

function scheduleCpuTurn() {
  clearCpuTimer();
  if (state.roundOver || state.currentPlayer === 0) {
    return;
  }

  state.cpuTimer = window.setTimeout(() => {
    takeCpuTurn(state.currentPlayer);
  }, CPU_TURN_DELAY_MS);
}

function clearCpuTimer() {
  if (state.cpuTimer) {
    window.clearTimeout(state.cpuTimer);
    state.cpuTimer = null;
  }
}

function takeCpuTurn(playerIndex) {
  if (state.roundOver || playerIndex !== state.currentPlayer) {
    return;
  }

  const player = state.players[playerIndex];
  const choice = chooseCpuCard(playerIndex);

  if (!choice) {
    const drawnCount = drawCards(playerIndex, 1);
    recordDraw(playerIndex, drawnCount);
    state.message = drawnCount > 0 ? `${player.name} drew a card.` : `${player.name} waits.`;
    playSound(drawnCount > 0 ? "draw" : "invalid");
    state.currentPlayer = getNextPlayer(playerIndex);
    render();
    scheduleCpuTurn();
    playHumanTurnCue(playerIndex);
    return;
  }

  const chosenCard = player.hand[choice.index];
  const chosenColor = chosenCard.type === "wild" ? chooseWildColor(playerIndex, choice.index) : null;
  playCard(playerIndex, choice.index, chosenColor);
}

function chooseCpuCard(playerIndex) {
  const player = state.players[playerIndex];
  const legalCards = player.hand
    .map((card, index) => ({ card, index }))
    .filter((entry) => isPlayable(entry.card));

  if (legalCards.length === 0) {
    return null;
  }

  if (state.difficulty === "Easy") {
    return legalCards[0];
  }

  if (state.difficulty === "Medium") {
    return legalCards.sort((a, b) => getMediumScore(b.card) - getMediumScore(a.card))[0];
  }

  return legalCards.sort((a, b) => {
    const bScore = getHardScore(playerIndex, b.card, b.index);
    const aScore = getHardScore(playerIndex, a.card, a.index);
    return bScore - aScore;
  })[0];
}

function getMediumScore(card) {
  if (card.value === "wild4") {
    return 60;
  }
  if (card.value === "draw2") {
    return 50;
  }
  if (card.value === "skip") {
    return 45;
  }
  if (card.value === "reverse") {
    return 35;
  }
  if (card.value === "wild") {
    return 30;
  }
  return 10;
}

function getHardScore(playerIndex, card, cardIndex) {
  const handAfter = state.players[playerIndex].hand.filter((_, index) => index !== cardIndex);
  const nextPlayer = getNextPlayer(playerIndex);
  const nextCount = state.players[nextPlayer].hand.length;
  const colorCounts = countColors(handAfter);
  const strongestColorCount = Math.max(...COLORS.map((color) => colorCounts[color]));
  let score = 10;

  if (card.type === "number") {
    score += colorCounts[card.color] * 5;
    score += Number(card.value);
  }

  if (card.value === "reverse") {
    score += 34 + (nextCount <= 2 ? 25 : 0);
  }

  if (card.value === "skip") {
    score += 46 + (nextCount <= 3 ? 34 : 0);
  }

  if (card.value === "draw2") {
    score += 58 + (nextCount <= 3 ? 38 : 0);
  }

  if (card.value === "wild") {
    score += 48 + strongestColorCount * 6;
  }

  if (card.value === "wild4") {
    score += 72 + strongestColorCount * 6 + (nextCount <= 3 ? 40 : 0);
  }

  if (handAfter.length === 1) {
    score += 28;
  }
  if (handAfter.length === 0) {
    score += 1000;
  }

  return score;
}

function chooseWildColor(playerIndex, cardIndex) {
  if (state.difficulty === "Easy") {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  const handAfter = state.players[playerIndex].hand.filter((_, index) => index !== cardIndex);
  const counts = countColors(handAfter);
  return COLORS
    .map((color) => ({ color, count: counts[color] }))
    .sort((a, b) => b.count - a.count)[0].color;
}

function playHumanTurnCue(previousPlayerIndex) {
  if (previousPlayerIndex !== 0 && state.currentPlayer === 0 && !state.roundOver) {
    window.setTimeout(() => {
      if (state.currentPlayer === 0 && !state.roundOver) {
        playSound("turn");
      }
    }, 360);
  }
}

function countColors(cards) {
  return COLORS.reduce((counts, color) => {
    counts[color] = cards.filter((card) => card.color === color).length;
    return counts;
  }, {});
}

function render() {
  const drawPrompt = shouldPromptHumanDraw();
  els.gameBoard.classList.toggle("is-waiting", !state.gameStarted);
  els.gameBoard.classList.toggle("is-counter", state.direction === -1);
  els.startPanel.classList.toggle("is-hidden", state.gameStarted);
  renderStatus();
  renderPlayers();
  renderPiles();
  renderPlayFeed();
  renderHumanHand();
  renderDifficulty();
  els.messageBox.textContent = state.message;
  els.newRoundButton.disabled = !state.gameStarted || !state.roundOver;
  els.drawCardButton.disabled = !state.gameStarted || state.roundOver || state.currentPlayer !== 0;
  els.drawPileButton.disabled = !state.gameStarted || state.roundOver || state.currentPlayer !== 0;
  els.unoButton.disabled = !state.gameStarted || state.roundOver;
  els.drawCardButton.classList.toggle("needs-draw", drawPrompt);
  els.drawPileButton.classList.toggle("needs-draw", drawPrompt);
}

function renderStatus() {
  if (!state.gameStarted) {
    els.turnPill.textContent = "Ready";
    els.colorPill.textContent = "No Color";
    els.colorPill.className = "status-pill color-pill neutral";
    els.directionPill.textContent = state.direction === 1 ? "Clockwise" : "Counter";
    els.roundPill.textContent = "Round 1";
    return;
  }

  const currentName = state.players[state.currentPlayer]?.name || "You";
  els.turnPill.textContent = state.roundOver ? "Round Done" : currentName === "You" ? "Your Turn" : `${currentName} Turn`;
  els.colorPill.textContent = COLOR_LABELS[state.currentColor];
  els.colorPill.className = `status-pill color-pill ${state.currentColor}`;
  els.directionPill.textContent = state.direction === 1 ? "Clockwise" : "Counter";
  els.roundPill.textContent = `Round ${state.roundNumber}`;
}

function renderPlayers() {
  for (let index = 1; index < state.players.length; index += 1) {
    const player = state.players[index];
    const panel = els.playerPanels[index];
    const count = player.hand.length;
    panel.className = `player-panel${state.currentPlayer === index && !state.roundOver ? " is-active" : ""}`;
    panel.innerHTML = `
      <div class="player-name-line">
        <span class="player-avatar">${escapeHtml(getPlayerInitials(index))}</span>
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="card-total">${escapeHtml(formatCardCount(count))}</span>
      </div>
      <div class="mini-card-row" aria-hidden="true">
        ${Array.from({ length: Math.min(count, 8) }, () => `<span class="mini-card"></span>`).join("")}
      </div>
      <div class="last-play">
        <span class="last-label">Last Play</span>
        ${renderLastMove(player.lastMove)}
      </div>
    `;
  }

  els.humanCardCount.textContent = formatCardCount(state.players[0].hand.length);
}

function renderPlayFeed() {
  if (!state.gameStarted) {
    els.playFeed.innerHTML = `
      <div class="feed-title">Last Moves</div>
      <div class="feed-empty">No moves yet.</div>
    `;
    return;
  }

  if (state.playFeed.length === 0) {
    els.playFeed.innerHTML = `
      <div class="feed-title">Last Moves</div>
      <div class="feed-empty">Play a card.</div>
    `;
    return;
  }

  els.playFeed.innerHTML = `
    <div class="feed-title">Last Moves</div>
    <div class="feed-list">
      ${state.playFeed.slice(0, 4).map((entry) => `
        <div class="feed-item ${entry.kind}">
          <span class="feed-player">${escapeHtml(entry.player)}</span>
          ${entry.card ? renderMiniCard(entry.card, "feed-card") : `<span class="feed-chip">Draw</span>`}
          <span class="feed-text">${escapeHtml(entry.text)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPiles() {
  els.drawPileCount.textContent = String(state.drawPile.length);
  els.discardPile.innerHTML = "";
  const topCard = getTopCard();
  if (topCard) {
    els.discardPile.appendChild(createCardElement(topCard, {
      asButton: false,
      playable: false,
      index: -1,
      played: topCard.id === state.lastPlayedId
    }));
  } else {
    els.discardPile.innerHTML = `<span class="pile-placeholder">Start</span>`;
  }
}

function renderHumanHand() {
  els.humanHand.innerHTML = "";
  state.players[0].hand.forEach((card, index) => {
    const playable = state.currentPlayer === 0 && !state.roundOver && isPlayable(card);
    els.humanHand.appendChild(createCardElement(card, {
      asButton: true,
      playable,
      index,
      played: false
    }));
  });
}

function createCardElement(card, options) {
  const element = document.createElement(options.asButton ? "button" : "div");
  const colorClass = card.type === "wild" ? "wild" : card.color;
  const label = getCardLabel(card);
  const needsSmallText = label.length > 2;
  element.className = [
    "card",
    colorClass,
    needsSmallText ? "small-text" : "",
    options.playable ? "is-playable" : "",
    options.played ? "is-played" : ""
  ].filter(Boolean).join(" ");
  element.dataset.index = String(options.index);
  element.setAttribute("aria-label", label);
  if (options.asButton) {
    element.type = "button";
  }
  element.innerHTML = getCardInnerHtml(label);
  return element;
}

function renderLastMove(lastMove) {
  if (!lastMove) {
    return `<span class="last-empty">Waiting</span>`;
  }
  if (lastMove.kind === "draw") {
    return `<span class="last-draw">${escapeHtml(lastMove.text)}</span>`;
  }
  return `
    <div class="last-card-wrap">
      ${renderMiniCard(lastMove.card, "last-card")}
      <span>${escapeHtml(lastMove.text)}</span>
    </div>
  `;
}

function renderMiniCard(card, extraClass) {
  const colorClass = getCardColorClass(card);
  const label = getCardLabel(card);
  const smallText = label.length > 2 ? " small-text" : "";
  return `<span class="mini-face-card ${extraClass} ${colorClass}${smallText}" aria-hidden="true">${getCardInnerHtml(label)}</span>`;
}

function getCardInnerHtml(label) {
  const safeLabel = escapeHtml(label);
  return `
    <span class="card-corner">${safeLabel}</span>
    <span class="card-symbol">${safeLabel}</span>
    <span class="card-corner bottom">${safeLabel}</span>
  `;
}

function getCardColorClass(card) {
  return card.type === "wild" ? "wild" : card.color;
}

function getPlayerInitials(index) {
  return index === 0 ? "Y" : `C${index}`;
}

function renderDifficulty() {
  document.querySelectorAll(".level-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === state.difficulty);
  });
}

function getCardLabel(card) {
  if (card.type === "number") {
    return card.value;
  }
  return ACTION_LABELS[card.value];
}

function getSoundForCard(card) {
  if (card.value === "reverse") {
    return "reverse";
  }
  if (card.value === "skip") {
    return "skip";
  }
  if (card.value === "draw2" || card.value === "wild4") {
    return "penalty";
  }
  if (card.type === "wild") {
    return "wild";
  }
  return "play";
}

function formatCardCount(count) {
  return `${count} card${count === 1 ? "" : "s"}`;
}

function shouldPromptHumanDraw() {
  if (!state.gameStarted || state.roundOver || state.currentPlayer !== 0) {
    return false;
  }
  return state.players[0].hand.length > 0 && !state.players[0].hand.some((card) => isPlayable(card));
}

function getHumanDrawHint() {
  return shouldPromptHumanDraw() ? "Draw a card." : "";
}

function openColorModal() {
  els.colorModal.classList.remove("is-hidden");
}

function closeColorModal() {
  state.pendingWildIndex = null;
  els.colorModal.classList.add("is-hidden");
}

function showRoundModal(result) {
  els.winnerName.textContent = result.winner === "You" ? "You Win!" : `${result.winner} Wins`;
  els.roundSummary.innerHTML = state.players.map((player, index) => `
    <div class="summary-row">
      <span>${escapeHtml(player.name)}</span>
      <span>${escapeHtml(formatCardCount(result.counts[index]))}</span>
    </div>
  `).join("");
  els.roundModal.classList.remove("is-hidden");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function closeRoundModal() {
  els.roundModal.classList.add("is-hidden");
}

function enableAudio() {
  if (state.audioReady) {
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    state.audioContext = new AudioContextClass();
    if (state.audioContext.state === "suspended") {
      state.audioContext.resume();
    }
    state.audioReady = true;
  } catch (error) {
    state.audioContext = null;
    state.audioReady = false;
  }
}

function playSound(kind) {
  if (!state.audioContext || !state.audioReady) {
    return;
  }
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  const sounds = {
    start() {
      playNoise(0.18, 0, 0.16, 1400);
      playTone(330, 0.07, 0, 0.12, "triangle");
      playTone(494, 0.08, 0.08, 0.14, "triangle");
      playTone(659, 0.1, 0.16, 0.16, "triangle");
      playTone(988, 0.12, 0.26, 0.12, "sine");
    },
    deal() {
      for (let index = 0; index < 6; index += 1) {
        playNoise(0.035, index * 0.055, 0.09, 2400);
        playTone(420 + index * 26, 0.035, index * 0.055, 0.045, "triangle");
      }
    },
    play() {
      playNoise(0.07, 0, 0.15, 2600);
      playTone(520, 0.045, 0.01, 0.09, "square");
      playTone(780, 0.065, 0.06, 0.08, "triangle");
      playNoise(0.035, 0.1, 0.05, 4200);
    },
    draw() {
      playNoise(0.16, 0, 0.13, 950);
      playSweep(260, 420, 0.18, 0.02, 0.09);
      playNoise(0.05, 0.16, 0.06, 2800);
    },
    reverse() {
      playNoise(0.1, 0, 0.09, 1800);
      playSweep(780, 320, 0.28, 0.02, 0.16);
      playSweep(320, 780, 0.22, 0.1, 0.09);
      playTone(520, 0.08, 0.24, 0.09, "square");
    },
    skip() {
      playTone(840, 0.055, 0, 0.14, "square");
      playTone(220, 0.08, 0.075, 0.13, "sawtooth");
      playNoise(0.08, 0.05, 0.08, 1800);
    },
    penalty() {
      playNoise(0.13, 0, 0.17, 520);
      playTone(190, 0.11, 0, 0.18, "sawtooth");
      playTone(300, 0.08, 0.105, 0.14, "square");
      playTone(155, 0.12, 0.19, 0.13, "sawtooth");
    },
    wild() {
      [440, 554, 659, 880].forEach((freq, index) => {
        playTone(freq, 0.08, index * 0.055, 0.13, "triangle");
      });
      playNoise(0.16, 0.02, 0.08, 2600);
    },
    uno() {
      playTone(523, 0.08, 0, 0.16, "triangle");
      playTone(784, 0.08, 0.08, 0.17, "triangle");
      playTone(1046, 0.13, 0.16, 0.14, "sine");
    },
    turn() {
      playTone(660, 0.07, 0, 0.08, "triangle");
      playTone(880, 0.08, 0.08, 0.09, "triangle");
    },
    invalid() {
      playTone(150, 0.12, 0, 0.18, "sawtooth");
      playTone(120, 0.1, 0.1, 0.12, "sawtooth");
    },
    win() {
      [392, 523, 659, 784, 1046].forEach((freq, index) => {
        playTone(freq, 0.12, index * 0.09, 0.17, "triangle");
      });
      playNoise(0.25, 0.16, 0.08, 3000);
    },
    loss() {
      [360, 300, 240].forEach((freq, index) => {
        playTone(freq, 0.14, index * 0.1, 0.13, "triangle");
      });
    }
  };

  if (sounds[kind]) {
    sounds[kind]();
  } else {
    sounds.play();
  }
}

function playTone(frequency, duration, delay, volume, type = "sine") {
  const context = state.audioContext;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSweep(fromFrequency, toFrequency, duration, delay, volume) {
  const context = state.audioContext;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(fromFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(toFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise(duration, delay, volume, cutoff) {
  const context = state.audioContext;
  const start = context.currentTime + delay;
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 1.1;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

if (isLocalDebugHost()) {
  window.__colorCardGame = {
    state,
    createDeck,
    isPlayable,
    startRound,
    startMatch,
    startGame,
    playCard,
    drawCards,
    chooseCpuCard,
    chooseWildColor,
    getNextPlayer,
    render
  };
}

function isLocalDebugHost() {
  return location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
}
