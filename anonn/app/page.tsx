"use client"

import { Shader, ChromaFlow, Swirl } from "shaders/react"
import { CustomCursor } from "@/components/custom-cursor"
import { GrainOverlay } from "@/components/grain-overlay"
import { useRef, useEffect, useState } from "react"
import Link from "next/link"

export default function Home() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const scrollThrottleRef = useRef<number>()
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const checkShaderReady = () => {
      if (shaderContainerRef.current) {
        const canvas = shaderContainerRef.current.querySelector("canvas")
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          setIsLoaded(true)
          return true
        }
      }
      return false
    }

    if (checkShaderReady()) return

    const intervalId = setInterval(() => {
      if (checkShaderReady()) {
        clearInterval(intervalId)
      }
    }, 100)

    const fallbackTimer = setTimeout(() => {
      setIsLoaded(true)
    }, 1500)

    return () => {
      clearInterval(intervalId)
      clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    // Rolling 7-day window from first page load
    const launchDate = (() => {
      const t = new Date()
      t.setDate(t.getDate() + 10)
      t.setHours(0, 0, 0, 0)
      return t.getTime()
    })()

    const calculateCountdown = () => {
      const distance = launchDate - new Date().getTime()
      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        })
      }
    }

    calculateCountdown()
    const timer = setInterval(calculateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  const scrollToSection = (index: number) => {
    if (scrollContainerRef.current) {
      const sectionWidth = scrollContainerRef.current.offsetWidth
      scrollContainerRef.current.scrollTo({
        left: sectionWidth * index,
        behavior: "smooth",
      })
      setCurrentSection(index)
    }
  }

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      touchStartX.current = e.touches[0].clientX
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (Math.abs(e.touches[0].clientY - touchStartY.current) > 10) {
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY
      const touchEndX = e.changedTouches[0].clientX
      const deltaY = touchStartY.current - touchEndY
      const deltaX = touchStartX.current - touchEndX

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
        if (deltaY > 0 && currentSection < 1) {
          scrollToSection(currentSection + 1)
        } else if (deltaY < 0 && currentSection > 0) {
          scrollToSection(currentSection - 1)
        }
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, { passive: true })
      container.addEventListener("touchmove", handleTouchMove, { passive: false })
      container.addEventListener("touchend", handleTouchEnd, { passive: true })
    }

    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart)
        container.removeEventListener("touchmove", handleTouchMove)
        container.removeEventListener("touchend", handleTouchEnd)
      }
    }
  }, [currentSection])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()

        if (!scrollContainerRef.current) return

        scrollContainerRef.current.scrollBy({
          left: e.deltaY,
          behavior: "instant",
        })

        const sectionWidth = scrollContainerRef.current.offsetWidth
        const scrollLeft = scrollContainerRef.current.scrollLeft
        const newSection = Math.round(scrollLeft / sectionWidth)

        if (newSection !== currentSection && newSection >= 0 && newSection <= 1) {
          setCurrentSection(newSection)
        }
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel)
      }
    }
  }, [currentSection])

  useEffect(() => {
    const handleScroll = () => {
      if (scrollThrottleRef.current) return

      scrollThrottleRef.current = requestAnimationFrame(() => {
        if (!scrollContainerRef.current) {
          scrollThrottleRef.current = undefined
          return
        }

        const sectionWidth = scrollContainerRef.current.offsetWidth
        const scrollLeft = scrollContainerRef.current.scrollLeft
        const newSection = Math.round(scrollLeft / sectionWidth)

        if (newSection !== currentSection && newSection >= 0 && newSection <= 1) {
          setCurrentSection(newSection)
        }

        scrollThrottleRef.current = undefined
      })
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true })
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll)
      }
      if (scrollThrottleRef.current) {
        cancelAnimationFrame(scrollThrottleRef.current)
      }
    }
  }, [currentSection])

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <CustomCursor />
      <GrainOverlay />

      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ contain: "strict" }}
      >
        <Shader className="h-full w-full">
          <Swirl
            colorA="#000000"
            colorB="#808080"
            speed={0.8}
            detail={0.8}
            blend={50}
            coarseX={40}
            coarseY={40}
            mediumX={40}
            mediumY={40}
            fineX={40}
            fineY={40}
          />
          <ChromaFlow
            baseColor="#000000"
            upColor="#000000"
            downColor="#808080"
            leftColor="#808080"
            rightColor="#808080"
            intensity={0.9}
            radius={1.8}
            momentum={25}
            maskType="alpha"
            opacity={0.97}
          />
        </Shader>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <nav
        className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 transition-opacity duration-700 sm:px-8 md:px-12 md:py-6 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <button onClick={() => scrollToSection(0)} className="transition-transform hover:scale-105">
          <svg 
            width="80" 
            height="40" 
            viewBox="0 0 318 124" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-16 sm:w-20 md:w-24"
          >
            <path d="M47 42L37 52V72L47 82H67L107 52V42H77V52L67 42H47Z" fill="#E8EAE9" />
            <path
              d="M129 64.0405H132.918V60.2201H148.28V49.4366H133.602V57.0775H129V48.8204H132.918V45H148.964V48.8204H152.758V75.4401H156.614V80H152.136V76.118H145.108V80H132.918V76.118H129V64.0405ZM144.424 75.4401V71.6813H148.28V64.7183H133.602V75.4401H144.424Z"
              fill="#E8EAE9"
            />
            <path
              d="M160.097 45H164.699V48.8204H167.871V45H180.061V48.8204H183.854V52.5792H187.71V80H183.232V53.257H179.376V49.4366H168.493V53.257H164.699V80H160.097V45Z"
              fill="#E8EAE9"
            />
            <path
              d="M195.111 72.2975H191.193V52.5792H195.111V48.8204H198.967V45H211.157V48.8204H214.951V52.5792H218.807V72.2975H214.951V76.118H211.157V80H198.967V76.118H195.111V72.2975ZM199.589 71.6813V75.4401H210.473V71.6813H214.329V53.257H210.473V49.4366H199.589V53.257H195.795V71.6813H199.589Z"
              fill="#E8EAE9"
            />
            <path
              d="M222.29 45H226.892V48.8204H230.064V45H242.254V48.8204H246.047V52.5792H249.903V80H245.426V53.257H241.57V49.4366H230.686V53.257H226.892V80H222.29V45Z"
              fill="#E8EAE9"
            />
            <path
              d="M253.386 45H257.989V48.8204H261.16V45H273.35V48.8204H277.144V52.5792H281V80H276.522V53.257H272.666V49.4366H261.782V53.257H257.989V80H253.386V45Z"
              fill="#E8EAE9"
            />
          </svg>
        </button>

        <div className="hidden items-center gap-8 md:flex"></div>
      </nav>

      <div
        ref={scrollContainerRef}
        data-scroll-container
        className={`relative z-10 h-screen overflow-x-auto overflow-y-hidden transition-opacity duration-700 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <section className="flex min-h-screen w-screen shrink-0 flex-col justify-center px-4 pb-16 pt-20 sm:px-6 sm:pt-24 md:px-12 md:pb-16">
          <div className="flex flex-col items-center justify-between gap-8 sm:gap-12 md:flex-row md:gap-12">
            <div className="w-full flex-1">
              <h1 className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 mb-4 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
                The Anonymous Home for<br className="hidden sm:block" /> Prediction Markets players.
              </h1>
              <p className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 text-sm leading-relaxed text-foreground/60 sm:text-base md:text-lg">
                A unified social platform featuring a comprehensive list of tools built for those who follow the action beyond the charts.
              </p>
            </div>

            <div className="hidden w-full flex-1 items-center justify-center sm:flex md:justify-end animate-in fade-in slide-in-from-right-8 duration-1000 delay-400">
              <img
                src="/monitor.png"
                alt="Retro monitor"
                className="animate-float h-auto w-full max-w-xs sm:max-w-sm md:max-w-md object-contain"
              />
            </div>
          </div>

          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 sm:bottom-32 md:bottom-24">
            <div className="flex gap-2 sm:gap-3 md:gap-4">
              {[
                { label: "Days", value: countdown.days, delay: "0ms" },
                { label: "Hours", value: countdown.hours, delay: "75ms" },
                { label: "Minutes", value: countdown.minutes, delay: "150ms" },
                { label: "Seconds", value: countdown.seconds, delay: "225ms" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="relative flex h-12 w-12 items-center justify-center sm:h-16 sm:w-16 md:h-20 md:w-20">
                    <div
                      className="animate-glow-pulse absolute inset-0 rounded-lg border border-foreground/20 bg-foreground/10 backdrop-blur-md"
                      style={{ animationDelay: item.delay }}
                    />
                    <span className="relative tabular-nums text-lg font-bold text-foreground sm:text-2xl md:text-3xl">
                      {String(item.value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="mt-2 text-xs font-medium text-foreground/60 md:text-sm">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-foreground/50 text-xs sm:text-sm mt-4 md:mt-6">Platform Launch</p>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:bottom-8 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
            {/* Join Beta — primary CTA */}
            <Link
              href="https://t.me/+vRlrRZHyN4ExZjhl"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shimmer inline-flex items-center gap-2 rounded-full bg-foreground/90 px-5 py-2.5 text-sm font-semibold text-background backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-foreground sm:px-6 sm:py-3 sm:text-base"
              aria-label="Join the beta on Telegram"
            >
              {/* Telegram icon */}
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Join Beta
            </Link>

            {/* X / Twitter icon */}
            <Link
              href="https://x.com/SuhradMakwana"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground/15 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-foreground/25 sm:h-11 sm:w-11"
              aria-label="Follow on X"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.514l-5.106-6.694-5.833 6.694H2.562l7.746-8.973L1.242 2.25h6.687l4.595 6.074 5.354-6.074zM17.15 18.75h1.832L6.883 4.236H4.908l12.242 14.514z" />
              </svg>
            </Link>
          </div>
        </section>
      </div>

      <style jsx global>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </main>
  )
}
