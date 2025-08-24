import { useEffect, useMemo, useRef, useState } from 'react'
import style from './App.module.scss'
import {useInterval, useLocalStorage} from "react-use";
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
  const [maxAnswerMs, setMaxAnswerMs] = useLocalStorage<number>("maxAnswerMs",5000)
  const [inputDelayMs, setInputDelayMs] = useLocalStorage<number>("inputDelayMs",1500)
  const [sequenceLength, setSequenceLength] = useLocalStorage<number>("sequenceLength",10)
  const [numberRange, setNumberRange] = useLocalStorage<number>("numberRange",4)
  const [nBack, setNBack] = useLocalStorage<number>("nBack", 2)

  const currentSeqTimeMs = useRef<number>(0)

  const canJudge = useMemo(() => currentIndex >= nBack, [currentIndex, nBack])
  const currentSeq:SequenceItem|undefined = useMemo(()=>sequence[currentIndex],[currentIndex,sequence])
  
  const generateSequence = () => {
    let result:SequenceItem[] = []
    for (let i = 0; i < sequenceLength; i++) {
      const number = Math.floor(Math.random() * numberRange) + 1
      let correctValue:"same"|"different"|"none" = "none";
      if (i >= nBack) correctValue = number === result[i - nBack].number ? "same" : "different";
      result.push({number, correctValue, userAnswer:undefined, answeredTimeMs:undefined})
    }
    setSequence(result)
  }

  const valueToKorean = (v: 'same' | 'different' | 'none' | undefined) => {
    if (v === 'same') return '같음'
    if (v === 'different') return '다름'
    if (v === 'none') return '비교불가'
    return '—'
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
    if (currentSeq.answeredTimeMs !== undefined && currentSeq.answeredTimeMs + inputDelayMs < currentSeqTimeMs.current) {
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
  const helperText = !canJudge && isPlaying ? `처음 ${nBack}개는 비교할 수 없어요` : '왼쪽 화살표=맞음, 오른쪽 화살표=틀림'
  return (
    <div className={style.app}>
      <h1>try N-back</h1>
      <div className={style.controls}>
        <button onClick={start} disabled={isPlaying}>시작</button>
        <button onClick={stop} disabled={!isPlaying}>정지</button>
      </div>
      <div className={style.info}>
        <div>상태: {statusText}</div>
        <div>{`문제: ${currentIndex + 1} / ${sequence.length}`}</div>
      </div>

      <div className={style.board}>
        <div className={style.number} data-feedback={currentSeq?.userAnswer ?? ''}>
          {currentSeq?.number ?? '—'}
        </div>
      </div>

      <div className={style.help}>{helperText}</div>
      <div className={style.result}>
        {!isPlaying && sequence.length > 0 && (
          <div className={style.resultInner}>
            {(() => {
              const judgeableCount = Math.max(sequence.length - nBack, 0)
              const answered = sequence.filter((s, i) => i >= nBack && s.userAnswer !== undefined)
              const correct = answered.filter(s => s.userAnswer === s.correctValue).length
              const accuracy = judgeableCount > 0 ? Math.round((correct / judgeableCount) * 100) : 0
              const times = answered.map(a => a.answeredTimeMs as number)
              const avgMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : undefined
              return (
                <div className={style.summary}> 
                  <div className={style.summaryItem}>정답: <strong>{correct}</strong> / {judgeableCount} <span className={style.muted}>({accuracy}%)</span></div>
                  <div className={style.summaryItem}>평균 지연: <strong>{avgMs ?? '—'}</strong> ms</div>
                </div>
              )
            })()}
            <table className={style.table}>
              <thead>
              <tr>
                <th>#</th>
                <th>숫자</th>
                <th>정답</th>
                <th>내 답</th>
                <th>지연(ms)</th>
                <th>판정</th>
              </tr>
              </thead>
              <tbody>
              {sequence.map((s, i) => {
                const judgeable = i >= nBack
                const answered = s.userAnswer !== undefined
                const correct = judgeable && answered && s.userAnswer === s.correctValue
                const incorrect = judgeable && answered && s.userAnswer !== s.correctValue
                const rowClass = correct ? style.rowCorrect : (incorrect ? style.rowWrong : style.rowMuted)
                return (
                  <tr key={i} className={rowClass}>
                    <td>{i + 1}</td>
                    <td>{s.number}</td>
                    <td>{valueToKorean(s.correctValue)}</td>
                    <td>{valueToKorean(s.userAnswer)}</td>
                    <td>{s.answeredTimeMs ?? '—'}</td>
                    <td>
                      {correct && <span className={style.badgeCorrect}>O</span>}
                      {incorrect && <span className={style.badgeWrong}>X</span>}
                      {!judgeable && <span className={style.badgeMuted}>—</span>}
                      {judgeable && !answered && <span className={style.badgeMuted}>미응답</span>}
                    </td>
                  </tr>
                )
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className={style.options}>
        <label>
          문제 갯수
        </label>
        <input type="number" min={3} step={1} max={100}
               value={sequenceLength} disabled={isPlaying}
               onChange={e => setSequenceLength(Number(e.target.value) || 3)}
        />
        <label>
          숫자 범위
        </label>
        <input type="number" min={2} step={1} max={9}
               value={numberRange} disabled={isPlaying}
               onChange={e => setNumberRange(Number(e.target.value) || 2)}
        />
        <label>
          N-back
        </label>
        <input type="number" min={1} step={1} max={5}
               value={nBack} disabled={isPlaying}
               onChange={e => setNBack(Number(e.target.value) || 1)}
        />


        <label>
          최대 답변시간(ms)
        </label>
        <input type="number" min={500} step={100}
               value={maxAnswerMs} disabled={isPlaying}
               onChange={e => setMaxAnswerMs(Number(e.target.value) || 0)}
        />
        
        <label>
          입력 후 대기시간(ms)
        </label>
        <input type="number" min={500} step={100}
               value={inputDelayMs} disabled={isPlaying}
               onChange={e => setInputDelayMs(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  )
}

export default App
