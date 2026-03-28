'use client'

import { motion } from 'framer-motion'

export default function BlobBottom() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute bottom-0 left-0 w-full h-64 bg-alliance-blue"
      style={{ clipPath: 'ellipse(75% 100% at 50% 100%)' }}
    />
  )
}
