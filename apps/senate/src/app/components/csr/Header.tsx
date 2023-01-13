'use client'

import { useState } from 'react'
import { RainbowConnect } from './RainbowConnect'

export const Header = (props: { title: string }) => {
    const [headerHeight, setHeaderHeight] = useState('h-[192px]')
    const [titleSize, setTitleSize] = useState('text-[78px]')

    return (
        <div
            className='absolute h-full w-11/12'
            onWheel={() => {
                if (window.scrollY > 35) {
                    setHeaderHeight('h-[96px]')
                    setTitleSize('text-[52px]')
                } else {
                    setHeaderHeight('h-[192px]')
                    setTitleSize('text-[78px]')
                }
            }}
        >
            <div
                className={`fixed z-10 flex w-full ${headerHeight} items-center justify-between border border-x-0 border-t-0 border-[#545454] bg-black px-10 transition-all`}
            >
                <h1
                    className={`${titleSize} font-extrabold text-white transition`}
                >
                    {props.title}
                </h1>
                <div className='pr-20'>
                    <RainbowConnect />
                </div>
            </div>
        </div>
    )
}