import { useEffect, useMemo, useRef, useState } from 'react'
import style from './App.module.scss'
import {useInterval} from "react-use";
import {useImmer} from "use-immer";

interface SequenceItem {
  number: number;
  correctValue:"same"|"different"|"none";
  userAnswer: "same"|"different"|undefined;
  answeredTimeMs: number|undefined;
}

function App() {
  const [sequence, setSequence] = useImmer<SequenceItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  //설정
  const [maxAnswerMs, setMaxAnswerMs] = useState<number>(5000)
  
  const currentSeqTimeMs = useRef<number>(0)

  const canJudge = useMemo(() => currentIndex >= 2, [currentIndex])
  const currentSeq:SequenceItem|undefined = useMemo(()=>sequence[currentIndex],[currentIndex,sequence])

  const score = useMemo(()=> sequence.filter(s=>s.userAnswer === s.correctValue).length,[sequence])
  
  const generateSequence = () => {
    let result:SequenceItem[] = []
    for (let i = 0; i < 10; i++) {
      const number = Math.floor(Math.random() * 4) + 1
      let correctValue:"same"|"different"|"none" = "none";
      if(i >= 2) correctValue = number === result[i - 2].number ? "same" : "different";
      result.push({number, correctValue, userAnswer:undefined, answeredTimeMs:undefined})
    }
    setSequence(result)
  }

  const goToNextItem = () => {
    if (currentIndex === sequence.length - 1) {
      setIsPlaying(false)
      return
    }
    setCurrentIndex(prevIdx => prevIdx + 1)
    currentSeqTimeMs.current = 0
  }

  const start = () => {
    if (isPlaying) return
    generateSequence()
    setCurrentIndex(-1)
    setIsPlaying(true)
    currentSeqTimeMs.current = 0
  }

  const stop = () => {
    setIsPlaying(false)
  }
  
  //1tick = 50ms
  useInterval(()=> {
    if (!isPlaying) return;
    currentSeqTimeMs.current += 50;
    //최대시간까지 입력하지 못한 경우 다음순서로 넘어감
    if (currentSeqTimeMs.current >= maxAnswerMs || currentIndex === -1) {
      goToNextItem()
      return;
    }
    //정답을 입력하고 1.5초 후 다음 순서로 넘어감
    if (currentSeq.answeredTimeMs !== undefined && currentSeq.answeredTimeMs + 1500 < currentSeqTimeMs.current) {
      goToNextItem()
      return;
    }
  },50);

  // key handling: Left = "맞음", Right = "틀림"
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || !canJudge) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (currentSeq.userAnswer !== undefined) return
      
      setSequence((draft) => {
        const seq = draft[currentIndex]
        if (seq) {
          seq.userAnswer = e.key === 'ArrowLeft' ? 'same' : 'different'
          seq.answeredTimeMs = currentSeqTimeMs.current
        }
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying, canJudge, currentIndex, sequence])


  const statusText = isPlaying ? '진행중' : '정지'
  const helperText = !canJudge && isPlaying ? '처음 두 개는 비교할 수 없어요' : '왼쪽 화살표=맞음, 오른쪽 화살표=틀림'

  return (
    <div className={style.app}>
      <h1>2-back</h1>
      <div className={style.controls}>
        <button onClick={start} disabled={isPlaying}>시작</button>
        <button onClick={stop} disabled={!isPlaying}>정지</button>
        <label className={style.speed}>
          속도(ms):
          <input
            type="number"
            min={500}
            step={100}
            value={maxAnswerMs}
            onChange={e => setMaxAnswerMs(Number(e.target.value) || 0)}
            disabled={isPlaying}
          />
        </label>
      </div>
      <div>
        <div>{"현재 답변시간 : "+(currentSeq?.answeredTimeMs ?? 0)}</div>
      </div>

      <div className={style.status}>
        상태: {statusText} · 점수: {score}
      </div>

      <div className={style.board}>
        <div className={style.number} data-feedback={currentSeq?.userAnswer ?? ''}>
          {currentSeq?.number ?? '—'}
        </div>
      </div>

      <div className={style.help}>{helperText}</div>
    </div>
  )
}

export default App
