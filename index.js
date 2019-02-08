const $ = function (val) { return document.querySelector(val) };
var playersTable;
var peer;
const rows = 9;
const cols = 6;
const gridElement = createGuiGrid();
var room;
var playersDb;
var player;


const playerColor = {
  0: "violet",
  1: "green",
  2: "blue",
  3: "yellow",
  4: "red",
  5: "black",
  6: "grey",
  7: "aqua"
}

initPeer();

function genId() {
  return (Date.now() * 1000).toString().replace('.', '');
}

function initPeer() {
  console.log('initializing peer')
  peer = Gun('https://gunjs.herokuapp.com/gun');
  let url;
  if (location.hash.length > 0) {
    url = location.hash.substring(1);
  } else {
    url = genId();
  }
  $('#url').textContent = location.origin + location.pathname + '#' + url;
  room = peer.get(url);
  changesDb = room.get('connected-reactions/'+url);
  changesDb.map().on(handleData, { change: true })

  playersDb = room.get('players');
  playersDb.map().on(data => listPeer(data), { change: true });
  player = genId();
  console.log("registering as player", player)
  playersDb.set(player);


}

function startGameOnline() {
  playersTable = {};
  length = 0;
  playersDb.map().once(data => {
    playersTable[data] = length++;
  })
  playersDb.once(() => {
    console.log('Found players table', playersTable);
    sendAll({ type: 'initGame', players: Object.keys(playersTable).length, playersTable: playersTable });
  })
 }
function initGame(mode, playersQuantity, remotePlayersTable) {
  //hide ui
  anime({
    targets: '#ui',
    scale: 1.5,
    opacity: 0,
    complete: function () {
      $('#ui').style.display = 'none';
    },
    easing: 'easeOutExpo',
    duration: 500
  })


  playersTable = playersTable || remotePlayersTable;
  isOnline = mode == 'online';

  if (isOnline) {
    players = playersQuantity;
  } else {
    players = parseInt($('input').value);
  }

  grid = createGrid();

  currentPlayer = 0;
  playersAlive = new Array(players).fill(true);
  winner = undefined;

  //animate grid
  anime({
    targets: 'table td',
    scale: [0, 1],
    opacity: 1,
    delay: anime.stagger(300, { grid: [cols, rows], from: 'center' }),
    easing: 'easeOutExpo',
    duration: 1000,
  })

}


function sendAll(data) {
  console.log('putting change', data)
  changesDb.get(genId()).put(JSON.stringify(data));
}

function listPeer(peer) {
  console.log(peer)
  //show in connections list
  let listItem = document.createElement('li');
  listItem.textContent = peer;
  $('#connections').append(listItem);
}

function handleData(data) {
  data = JSON.parse(data);
  console.log('received data', data);

  switch (data.type) {
    case 'interact':
      interactAsPlayer(data.row, data.col, playersTable[data.player]);
      break;
    case 'peers':
      showPeer(data.peer);
      break;
    case 'ripple':
      drawRipple(data.row, data.col, playersTable[data.player]);
      break
    case 'initGame':
      initGame('online', data.players, data.playersTable);
  }
}

function guiExplode(row,col) {
  gridElement.rows[row].cells[col].innerHTML = "";
}
function guidAddProton(row,col,player,fromRow,fromCol) {
  var protonElement = document.createElement('span');
  protonElement.classList.toggle("circle");
  gridElement.rows[row].cells[col].append(protonElement);

  for (let i = 0; i < gridElement.rows[row].cells[col].children.length; i++) {
    gridElement.rows[row].cells[col].children[i].style.background = playerColor[player];
  }

  anime({
    targets: protonElement,
    translateX: [window.innerWidth / cols * fromCol - window.innerWidth / cols * col, 0],
    translateY: [window.innerHeight / rows * fromRow - window.innerHeight / rows * row, 0],
    scale: [0, 1],
  })
}
function guiSetTurn(turn) {
  gridElement.style.background = playerColor[turn]
}
function guiWinner(winner) {
  setTimeout(() => alert('The winner is player ' + playerColor[winner]), 1000)
}

function createAtom() {
  return {
    balls: 0,
    player: undefined
  }
}
function addProtonAsPlayer(row, col, player, fromRow, fromCol) {
  if (!gridContains(row, col)) {
    return
  }
  console.log('adding', row, col)
  var previousPlayer = grid[row][col].player;
  grid[row][col].player = player;
  grid[row][col].balls++;
  if (previousPlayer != undefined && typeof winner == 'undefined') {
    console.log('checking alive')
    findPlayersAlive();
    findWinner();
  }
  guidAddProton(row,col,player,fromRow,fromCol);
  if (shouldExplode(row, col)) {
    explode(row, col);
  }
}
function drawRipple(row, col, player) {
  anime({
    targets: gridElement.rows[row].cells[col],
    boxShadow: [`inset 0px 0px 0px 10px ${playerColor[player]}`, `inset 0px 0px 0px 0px ${playerColor[player]}`],
    duration: 2000
  })
}
function canInteract(row, col, player) {
  return player == currentPlayer && (player == grid[row][col].player ||
    typeof grid[row][col].player == "undefined" || grid[row][col].balls == 0)
}
function interactAsPlayer(row, col, player) {
  drawRipple(row, col, player);
  if (!gridContains(row, col)) { return };
  console.log('TRYING TO INTERACT', row, col, player)
  if (!canInteract(row, col, player)) {
    console.log('prevented interaction')
    return;
  }
  addProtonAsPlayer(row, col, player);
  nextTurn();
}
function createGrid() {
  var tmpGrid = new Array(rows);
  for (let i = 0; i < rows; i++) {
    tmpGrid[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      tmpGrid[i][j] = createAtom();
    }
  }
  return tmpGrid;
}

function createGuiGrid() {
  for (let row = 0; row < rows; row++) {
    var rowElement = document.createElement('tr');
    $('table').append(rowElement);
    for (let col = 0; col < cols; col++) {
      var cell = document.createElement('td');
      cell.style.opacity = 0;
      cell.onclick = function () {
        if (isOnline) {
          if (!canInteract(row, col, playersTable[player])) {
            sendAll({ type: 'ripple', row, col, player: player });

          } else {
            sendAll({ type: 'interact', row, col, player: player });

          }
        } else {
          interactAsPlayer(row, col, currentPlayer);
        }
      }
      rowElement.append(cell);

    }
  }

  return $('table');

}

function line(fromX, fromY, toX, toY) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function pixelToGrid(x, y) {
  return { row: Math.floor(y / cellHeight), col: Math.floor(x / cellWidth) };
}

function shouldExplode(row, col) {
  var touchesRowBorders = row == 0 || row == rows - 1;
  var touchesColBorders = col == 0 || col == cols - 1;
  var cell = grid[row][col];
  if (touchesRowBorders && touchesColBorders && cell.balls > 1) {
    return true;
  } else if ((touchesRowBorders || touchesColBorders) && cell.balls > 2) {
    return true;
  } else if (cell.balls > 3) {
    return true;
  }
  return false;
}

function gridContains(row, col) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function explode(row, col) {
  if (typeof winner != 'undefined') {
    return
  }
  console.log('exploding', row, col);
  grid[row][col].balls = 0;
  var cell = grid[row][col];
  guiExplode(row,col);

  addProtonAsPlayer(row, col + 1, cell.player, row, col);
  addProtonAsPlayer(row, col - 1, cell.player, row, col);
  addProtonAsPlayer(row + 1, col, cell.player, row, col);
  addProtonAsPlayer(row - 1, col, cell.player, row, col);
}

function findPlayersAlive() {
  for (var i = 0; i < playersAlive.length; i++) {
    playersAlive[i] = false;
  }
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var cell = grid[row][col];
      if (cell.balls > 0) {
        playersAlive[cell.player] = true;
      }
    }
  }
}

function findWinner() {
  for (var i = 0; i < players; i++) {
    if (playersAlive[i]) {
      if (typeof winner == 'undefined') {
        winner = i;
      } else if (winner >= 0) {
        winner = undefined;
        break
      }
    }
  }
  if (winner >= 0) {
    guiWinner(winner)
  }
}

function nextTurn() {
  currentPlayer++;
  if (currentPlayer >= players) {
    currentPlayer = 0;
  }
  if (!playersAlive[currentPlayer]) {
    nextTurn();
    return;
  }
  guiSetTurn(currentPlayer)
}
