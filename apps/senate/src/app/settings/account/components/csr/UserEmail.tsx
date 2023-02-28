'use client'

import { useState, useEffect } from 'react'
import { trpc } from '../../../../../server/trpcClient'

const UserEmail = () => {
    const [currentEmail, setCurrentEmail] = useState('')

    const setEmail = trpc.accountSettings.setEmail.useMutation()
    const email = trpc.accountSettings.getEmail.useQuery()

    useEffect(() => {
        setCurrentEmail(email.data ?? '')
    }, [email.data])

    return (
        <div>
            <div className='text-[24px] font-light text-white'>
                Your Email Address
            </div>

            <div className={`flex h-[46px] w-fit flex-row items-center`}>
                <input
                    className={`h-full w-[320px] focus:outline-none ${
                        email.data == currentEmail ? ' bg-[#D9D9D9]' : ''
                    } px-2 text-black `}
                    value={currentEmail}
                    onChange={(e) => {
                        setCurrentEmail(String(e.target.value))
                    }}
                />

                <div
                    className='flex h-full w-[72px] cursor-pointer flex-col justify-center bg-[#ABABAB] text-center'
                    onClick={() => {
                        setEmail.mutate({ email: currentEmail })
                    }}
                >
                    Save
                </div>
            </div>
            {setEmail.error && (
                <div className='flex flex-col text-white'>
                    {JSON.parse(setEmail.error.message).map((err: Error) => (
                        <div>{err.message}</div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default UserEmail
