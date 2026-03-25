'use client'

import { useState, useMemo, useCallback } from 'react'
import type { ParsedData, Place } from '@/lib/types'
import { generateQuiz, getQuizzableCities, type QuizQuestion } from '@/lib/quiz'
import { getCategoryInfo } from '@/lib/categories'
import type { PlaceCategory } from '@/lib/categories'

interface QuizViewProps {
  data: ParsedData
  filteredPlaces: Place[]
  onSelectPlace?: (place: Place) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-sm">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100)
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 50 ? 'bg-yellow-500' :
    'bg-red-500'
  return (
    <div className="w-full bg-[var(--muted)] rounded-full h-2 mt-1">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function gradeEmoji(pct: number) {
  if (pct === 100) return '🏆'
  if (pct >= 80) return '🌟'
  if (pct >= 60) return '👍'
  if (pct >= 40) return '🤔'
  return '📚'
}

function gradeText(pct: number) {
  if (pct === 100) return 'Perfect score! You know this city like a local!'
  if (pct >= 80) return 'Impressive! You really know your saved places.'
  if (pct >= 60) return 'Not bad! You remember more than you think.'
  if (pct >= 40) return 'Getting there — maybe revisit your saved places?'
  return 'Looks like you need to explore more! 🗺️'
}

// ---------------------------------------------------------------------------
// Setup screen
// ---------------------------------------------------------------------------

function QuizSetup({
  places,
  onStart,
}: {
  places: Place[]
  onStart: (city: string | null, questionCount: number) => void
}) {
  const cities = useMemo(() => getQuizzableCities(places), [places])
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [questionCount, setQuestionCount] = useState(10)

  const handleStart = () => {
    onStart(selectedCity || null, questionCount)
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6"
      data-testid="quiz-setup"
    >
      <span className="text-6xl">🧠</span>
      <div>
        <h2 className="text-2xl font-bold mb-2">How Well Do You Know…</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          Test your knowledge of your saved places. Pick a city for a focused
          quiz, or go global!
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* City picker */}
        <div className="text-left">
          <label className="text-xs font-semibold text-[var(--muted-foreground)] mb-1 block">
            Focus on a city (optional)
          </label>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="w-full text-sm bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2"
            data-testid="quiz-city-select"
          >
            <option value="">🌍 All cities</option>
            {cities.map(({ city, placeCount }) => (
              <option key={city} value={city}>
                {city} ({placeCount} places)
              </option>
            ))}
          </select>
        </div>

        {/* Question count */}
        <div className="text-left">
          <label className="text-xs font-semibold text-[var(--muted-foreground)] mb-1 block">
            Number of questions
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                data-testid={`quiz-count-${n}`}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  questionCount === n
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          data-testid="quiz-start-btn"
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Start Quiz →
        </button>
      </div>

      {places.length < 5 && (
        <p className="text-xs text-yellow-500 max-w-xs">
          ⚠️ You have very few saved places. Upload more data for a better quiz experience.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Question card
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  questionIndex,
  total,
  onAnswer,
}: {
  question: QuizQuestion
  questionIndex: number
  total: number
  onAnswer: (index: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null

  const handleSelect = (i: number) => {
    if (answered) return
    setSelected(i)
    // Brief delay so user sees result, then advance
    setTimeout(() => onAnswer(i), 900)
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg mx-auto" data-testid="quiz-question-card">
      {/* Progress */}
      <div className="text-xs text-[var(--muted-foreground)] text-center">
        Question {questionIndex + 1} of {total}
      </div>

      {/* Place context */}
      {question.place && (
        <div className="flex items-center gap-2 justify-center text-sm text-[var(--muted-foreground)]">
          <span>
            {question.place.category
              ? getCategoryInfo(question.place.category as PlaceCategory).emoji
              : '📍'}
          </span>
          {question.place.rating && <StarRating rating={question.place.rating} />}
          {question.place.list && (
            <span className="bg-[var(--muted)] px-2 py-0.5 rounded-full text-xs">
              {question.place.list}
            </span>
          )}
        </div>
      )}

      {/* Question */}
      <h3
        className="text-lg font-semibold text-center leading-snug"
        data-testid="quiz-question-text"
      >
        {question.question}
      </h3>

      {/* Answers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.answers.map((ans, i) => {
          let variant = 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary)]/20'
          if (answered) {
            if (i === question.correctIndex) {
              variant = 'bg-green-600/20 border-2 border-green-500 text-green-400'
            } else if (i === selected && i !== question.correctIndex) {
              variant = 'bg-red-600/20 border-2 border-red-500 text-red-400'
            } else {
              variant = 'bg-[var(--muted)] opacity-40 text-[var(--muted-foreground)]'
            }
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              data-testid={`quiz-answer-${i}`}
              className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${variant}`}
            >
              <span className="opacity-50 mr-2 text-xs">{String.fromCharCode(65 + i)}.</span>
              {ans}
            </button>
          )
        })}
      </div>

      {/* Hint */}
      {answered && question.hint && (
        <p className="text-xs text-center text-[var(--muted-foreground)] italic">
          💡 {question.hint}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results screen
// ---------------------------------------------------------------------------

function QuizResults({
  questions,
  answers,
  city,
  onRetry,
  onSelectPlace,
}: {
  questions: QuizQuestion[]
  answers: number[]
  city: string | null
  onRetry: () => void
  onSelectPlace?: (place: Place) => void
}) {
  const score = answers.filter((a, i) => a === questions[i].correctIndex).length
  const total = questions.length
  const pct = Math.round((score / total) * 100)

  return (
    <div className="flex-1 overflow-y-auto" data-testid="quiz-results">
      <div className="max-w-lg mx-auto p-6 flex flex-col gap-6">
        {/* Score */}
        <div className="text-center" data-testid="quiz-score">
          <span className="text-6xl">{gradeEmoji(pct)}</span>
          <h2 className="text-3xl font-bold mt-3">{score}/{total}</h2>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">{pct}% correct</p>
          <ScoreBar score={score} total={total} />
          <p className="text-sm mt-3">{gradeText(pct)}</p>
          {city && <p className="text-xs text-[var(--muted-foreground)] mt-1">Quiz: {city}</p>}
        </div>

        {/* Answer review */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)]">Review</h3>
          {questions.map((q, i) => {
            const correct = answers[i] === q.correctIndex
            return (
              <div
                key={q.id}
                data-testid="quiz-review-row"
                className={`rounded-xl p-3 border ${
                  correct
                    ? 'border-green-700/40 bg-green-900/10'
                    : 'border-red-700/40 bg-red-900/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">{correct ? '✅' : '❌'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug">{q.question}</p>
                    {!correct && (
                      <p className="text-xs text-green-400 mt-0.5">
                        ✓ {q.answers[q.correctIndex]}
                      </p>
                    )}
                    {!correct && answers[i] !== -1 && (
                      <p className="text-xs text-red-400">
                        ✗ {q.answers[answers[i]]}
                      </p>
                    )}
                  </div>
                  {q.place && onSelectPlace && (
                    <button
                      onClick={() => onSelectPlace(q.place!)}
                      className="text-xs text-[var(--primary)] hover:underline shrink-0"
                      title={`View ${q.place.name}`}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Retry */}
        <button
          onClick={onRetry}
          data-testid="quiz-retry-btn"
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main QuizView
// ---------------------------------------------------------------------------

type QuizPhase = 'setup' | 'playing' | 'results'

export function QuizView({ data, filteredPlaces, onSelectPlace }: QuizViewProps) {
  const [phase, setPhase] = useState<QuizPhase>('setup')
  const [city, setCity] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])

  const handleStart = useCallback(
    (selectedCity: string | null, count: number) => {
      const qs = generateQuiz(filteredPlaces, selectedCity, count)
      if (qs.length === 0) return
      setCity(selectedCity)
      setQuestions(qs)
      setCurrentIndex(0)
      setAnswers([])
      setPhase('playing')
    },
    [filteredPlaces],
  )

  const handleAnswer = useCallback(
    (answerIndex: number) => {
      const newAnswers = [...answers, answerIndex]
      setAnswers(newAnswers)
      if (currentIndex + 1 >= questions.length) {
        setPhase('results')
      } else {
        setCurrentIndex(i => i + 1)
      }
    },
    [answers, currentIndex, questions.length],
  )

  const handleRetry = useCallback(() => {
    setPhase('setup')
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="quiz-view">
      {/* Header bar */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-3">
        <span className="text-xl">🧠</span>
        <h2 className="text-sm font-semibold">City Knowledge Quiz</h2>
        {phase === 'playing' && (
          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>{currentIndex + 1} / {questions.length}</span>
            {city && <span className="bg-[var(--muted)] px-2 py-0.5 rounded-full">{city}</span>}
            <div className="w-20 bg-[var(--muted)] rounded-full h-1.5">
              <div
                className="bg-[var(--primary)] h-1.5 rounded-full transition-all"
                style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        )}
        {phase === 'results' && (
          <button
            onClick={handleRetry}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            New Quiz
          </button>
        )}
      </div>

      {/* Body */}
      {phase === 'setup' && (
        <QuizSetup places={filteredPlaces} onStart={handleStart} />
      )}

      {phase === 'playing' && questions[currentIndex] && (
        <div className="flex-1 flex flex-col justify-center p-6 overflow-y-auto">
          <QuestionCard
            key={questions[currentIndex].id}
            question={questions[currentIndex]}
            questionIndex={currentIndex}
            total={questions.length}
            onAnswer={handleAnswer}
          />
        </div>
      )}

      {phase === 'results' && (
        <QuizResults
          questions={questions}
          answers={answers}
          city={city}
          onRetry={handleRetry}
          onSelectPlace={onSelectPlace}
        />
      )}
    </div>
  )
}
