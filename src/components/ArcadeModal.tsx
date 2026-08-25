import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Gamepad2, RotateCw, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type ArcadeModalProps = {
  open: boolean
  onClose: () => void
}

type Direction = { x: number; y: number }
type Point = { x: number; y: number }

const snakeCanvas = 360
const snakeCell = 18
const snakeCells = snakeCanvas / snakeCell

function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }])
  const foodRef = useRef<Point>({ x: 15, y: 10 })
  const directionRef = useRef<Direction>({ x: 1, y: 0 })
  const nextDirectionRef = useRef<Direction>({ x: 1, y: 0 })
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')

  const draw = useCallback(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.fillStyle = '#07130f'
    context.fillRect(0, 0, snakeCanvas, snakeCanvas)
    context.strokeStyle = '#16382c'
    context.lineWidth = 1
    for (let index = 0; index <= snakeCells; index += 1) {
      context.beginPath()
      context.moveTo(index * snakeCell, 0)
      context.lineTo(index * snakeCell, snakeCanvas)
      context.stroke()
      context.beginPath()
      context.moveTo(0, index * snakeCell)
      context.lineTo(snakeCanvas, index * snakeCell)
      context.stroke()
    }
    context.fillStyle = '#ff5c1a'
    context.fillRect(foodRef.current.x * snakeCell + 3, foodRef.current.y * snakeCell + 3, snakeCell - 6, snakeCell - 6)
    snakeRef.current.forEach((part, index) => {
      context.fillStyle = index === 0 ? '#fff2b5' : '#58d9b2'
      context.fillRect(part.x * snakeCell + 2, part.y * snakeCell + 2, snakeCell - 4, snakeCell - 4)
    })
  }, [])

  const reset = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
    foodRef.current = { x: 15, y: 10 }
    directionRef.current = { x: 1, y: 0 }
    nextDirectionRef.current = { x: 1, y: 0 }
    setScore(0)
    setStatus('playing')
  }, [])

  const steer = useCallback((direction: Direction) => {
    const current = directionRef.current
    if (current.x + direction.x === 0 && current.y + direction.y === 0) return
    nextDirectionRef.current = direction
    setStatus((currentStatus) => currentStatus === 'idle' ? 'playing' : currentStatus)
  }, [])

  useEffect(() => draw(), [draw, score, status])

  useEffect(() => {
    if (status !== 'playing') return
    const timer = window.setInterval(() => {
      directionRef.current = nextDirectionRef.current
      const head = snakeRef.current[0]
      const next = {
        x: (head.x + directionRef.current.x + snakeCells) % snakeCells,
        y: (head.y + directionRef.current.y + snakeCells) % snakeCells,
      }
      if (snakeRef.current.some((part) => part.x === next.x && part.y === next.y)) {
        setStatus('over')
        return
      }
      const snake = [next, ...snakeRef.current]
      if (next.x === foodRef.current.x && next.y === foodRef.current.y) {
        setScore((value) => value + 10)
        let food = { x: Math.floor(Math.random() * snakeCells), y: Math.floor(Math.random() * snakeCells) }
        while (snake.some((part) => part.x === food.x && part.y === food.y)) {
          food = { x: Math.floor(Math.random() * snakeCells), y: Math.floor(Math.random() * snakeCells) }
        }
        foodRef.current = food
      } else {
        snake.pop()
      }
      snakeRef.current = snake
      draw()
    }, 115)
    return () => window.clearInterval(timer)
  }, [draw, status])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const controls: Record<string, Direction> = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      }
      if (controls[event.key]) {
        event.preventDefault()
        steer(controls[event.key])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [steer])

  return (
    <div className="game-shell">
      <div className="game-score"><span>SNAKE_84</span><strong>{String(score).padStart(4, '0')}</strong></div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={snakeCanvas} height={snakeCanvas} aria-label="Tablero del juego Snake" />
        {status !== 'playing' && (
          <div className="game-overlay">
            <strong>{status === 'over' ? 'FIN DE PARTIDA' : 'LISTO PARA SALIR'}</strong>
            <button type="button" onClick={reset}>{status === 'over' ? 'Otra vuelta' : 'Jugar'}</button>
          </div>
        )}
      </div>
      <div className="touch-controls snake-controls" aria-label="Controles táctiles">
        <button type="button" onClick={() => steer({ x: 0, y: -1 })} aria-label="Arriba"><ArrowUp /></button>
        <button type="button" onClick={() => steer({ x: -1, y: 0 })} aria-label="Izquierda"><ArrowLeft /></button>
        <button type="button" onClick={() => steer({ x: 0, y: 1 })} aria-label="Abajo"><ArrowDown /></button>
        <button type="button" onClick={() => steer({ x: 1, y: 0 })} aria-label="Derecha"><ArrowRight /></button>
      </div>
    </div>
  )
}

const boardWidth = 10
const boardHeight = 18
const blockSize = 22
const colors = ['#000000', '#ff5c1a', '#f3c94b', '#58d9b2', '#e9e1cd', '#af7dff']
const shapes = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
]

type FallingPiece = { matrix: number[][]; x: number; y: number; color: number }

function emptyBoard() {
  return Array.from({ length: boardHeight }, () => Array(boardWidth).fill(0) as number[])
}

function BlockGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<number[][]>(emptyBoard())
  const pieceRef = useRef<FallingPiece>({ matrix: shapes[0], x: 3, y: 0, color: 1 })
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')

  const newPiece = useCallback(() => {
    const index = Math.floor(Math.random() * shapes.length)
    pieceRef.current = { matrix: shapes[index], x: 3, y: 0, color: (index % (colors.length - 1)) + 1 }
  }, [])

  const collides = useCallback((piece: FallingPiece, offsetX = 0, offsetY = 0, matrix = piece.matrix) => {
    return matrix.some((row, y) => row.some((cell, x) => {
      if (!cell) return false
      const boardX = piece.x + x + offsetX
      const boardY = piece.y + y + offsetY
      return boardX < 0 || boardX >= boardWidth || boardY >= boardHeight || (boardY >= 0 && boardRef.current[boardY][boardX] > 0)
    }))
  }, [])

  const draw = useCallback(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.fillStyle = '#07130f'
    context.fillRect(0, 0, boardWidth * blockSize, boardHeight * blockSize)
    const paint = (value: number, x: number, y: number) => {
      context.fillStyle = colors[value]
      context.fillRect(x * blockSize + 1, y * blockSize + 1, blockSize - 2, blockSize - 2)
      context.fillStyle = 'rgba(255,255,255,.18)'
      context.fillRect(x * blockSize + 3, y * blockSize + 3, blockSize - 6, 3)
    }
    boardRef.current.forEach((row, y) => row.forEach((value, x) => value && paint(value, x, y)))
    pieceRef.current.matrix.forEach((row, y) => row.forEach((value, x) => value && paint(pieceRef.current.color, pieceRef.current.x + x, pieceRef.current.y + y)))
  }, [])

  const mergeAndContinue = useCallback(() => {
    const piece = pieceRef.current
    piece.matrix.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && piece.y + y >= 0) boardRef.current[piece.y + y][piece.x + x] = piece.color
    }))
    const remaining = boardRef.current.filter((row) => row.some((cell) => !cell))
    const cleared = boardHeight - remaining.length
    while (remaining.length < boardHeight) remaining.unshift(Array(boardWidth).fill(0) as number[])
    boardRef.current = remaining
    if (cleared) setScore((value) => value + cleared * cleared * 100)
    newPiece()
    if (collides(pieceRef.current)) setStatus('over')
  }, [collides, newPiece])

  const drop = useCallback(() => {
    if (!collides(pieceRef.current, 0, 1)) pieceRef.current.y += 1
    else mergeAndContinue()
    draw()
  }, [collides, draw, mergeAndContinue])

  const move = useCallback((x: number) => {
    if (status === 'idle') setStatus('playing')
    if (!collides(pieceRef.current, x, 0)) pieceRef.current.x += x
    draw()
  }, [collides, draw, status])

  const rotate = useCallback(() => {
    const rotated = pieceRef.current.matrix[0].map((_, index) => pieceRef.current.matrix.map((row) => row[index]).reverse())
    if (!collides(pieceRef.current, 0, 0, rotated)) pieceRef.current.matrix = rotated
    draw()
  }, [collides, draw])

  const reset = useCallback(() => {
    boardRef.current = emptyBoard()
    newPiece()
    setScore(0)
    setStatus('playing')
  }, [newPiece])

  useEffect(() => draw(), [draw, score, status])

  useEffect(() => {
    if (status !== 'playing') return
    const timer = window.setInterval(drop, 520)
    return () => window.clearInterval(timer)
  }, [drop, status])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) event.preventDefault()
      if (event.key === 'ArrowLeft') move(-1)
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowDown') drop()
      if (event.key === 'ArrowUp' || event.key === ' ') rotate()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drop, move, rotate])

  return (
    <div className="game-shell block-game">
      <div className="game-score"><span>BLOQUES_G</span><strong>{String(score).padStart(5, '0')}</strong></div>
      <div className="canvas-wrap blocks-canvas">
        <canvas ref={canvasRef} width={boardWidth * blockSize} height={boardHeight * blockSize} aria-label="Tablero del juego de bloques" />
        {status !== 'playing' && (
          <div className="game-overlay">
            <strong>{status === 'over' ? 'TALLER LLENO' : 'PIEZAS PREPARADAS'}</strong>
            <button type="button" onClick={reset}>{status === 'over' ? 'Vaciar taller' : 'Jugar'}</button>
          </div>
        )}
      </div>
      <div className="touch-controls blocks-controls" aria-label="Controles táctiles">
        <button type="button" onClick={() => move(-1)} aria-label="Mover a la izquierda"><ArrowLeft /></button>
        <button type="button" onClick={rotate} aria-label="Girar pieza"><RotateCw /></button>
        <button type="button" onClick={drop} aria-label="Bajar pieza"><ArrowDown /></button>
        <button type="button" onClick={() => move(1)} aria-label="Mover a la derecha"><ArrowRight /></button>
      </div>
    </div>
  )
}

export default function ArcadeModal({ open, onClose }: ArcadeModalProps) {
  const [game, setGame] = useState<'menu' | 'snake' | 'blocks'>('menu')
  const closeRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0)

      if (!focusable.length) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !modalRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.classList.add('modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop arcade-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className="arcade-modal" role="dialog" aria-modal="true" aria-labelledby="arcade-title">
        <header className="arcade-header">
          <button className="arcade-brand" type="button" onClick={() => setGame('menu')}>
            <Gamepad2 aria-hidden="true" /><span><strong id="arcade-title">KAAMCADE</strong><small>Zona de descanso no automatizada</small></span>
          </button>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Cerrar recreativa"><X /></button>
        </header>

        {game === 'menu' ? (
          <div className="arcade-menu">
            <div className="arcade-intro"><Trophy /><h3>Elige tu descanso</h3><p>Dos clásicos reinterpretados para volver al workflow con los reflejos en orden.</p></div>
            <button className="game-cartridge snake-cartridge" type="button" onClick={() => setGame('snake')}>
              <span className="cartridge-screen snake-preview"><i /><i /><i /><i /><b /></span>
              <span><strong>Snake_84</strong><small>Come leads. No te muerdas la estrategia.</small></span>
              <ArrowRight />
            </button>
            <button className="game-cartridge blocks-cartridge" type="button" onClick={() => setGame('blocks')}>
              <span className="cartridge-screen blocks-preview"><i /><i /><i /><i /><b /><b /><b /></span>
              <span><strong>Bloques_G</strong><small>Encaja piezas antes de que el backlog gane.</small></span>
              <ArrowRight />
            </button>
            <p className="arcade-help">Teclado: flechas o WASD · móvil: controles en pantalla</p>
          </div>
        ) : (
          <div className="arcade-game-view">
            <button className="back-to-games" type="button" onClick={() => setGame('menu')}><ArrowLeft /> Cambiar juego</button>
            {game === 'snake' ? <SnakeGame /> : <BlockGame />}
          </div>
        )}
      </section>
    </div>
  )
}
