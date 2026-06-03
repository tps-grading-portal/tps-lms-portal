/**
 * X-62A VISTA (Variable In-flight Simulator Test Aircraft) silhouette.
 * Used as a low-opacity watermark on login/auth screens.
 * VISTA is an F-16D modified with a research flight control system,
 * operated by USAF Test Pilot School at Edwards AFB.
 *
 * Profile: level flight, aircraft facing right.
 */
export function X62Silhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 820 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Main fuselage body */}
      <path d="
        M 788,116
        C 758,100 724,87 692,79
        C 668,73 644,69 622,67
        C 604,65 588,65 572,67
        C 557,69 542,75 528,71
        C 513,67 500,56 485,47
        C 469,38 451,33 432,33
        C 413,33 394,39 376,50
        C 359,60 342,75 323,86
        L 290,99
        L 242,110
        L 186,119
        L 152,123
        L 132,121
        L 110,120
        L 80,122
        L 48,124
        L 46,136
        L 78,136
        L 110,137
        L 132,138
        L 152,140
        L 186,143
        L 242,150
        L 290,158
        L 323,164
        C 342,170 359,180 376,183
        C 394,187 413,187 432,185
        C 451,183 469,177 485,170
        C 500,163 513,157 528,159
        C 542,161 557,165 572,166
        C 588,166 604,164 622,160
        C 644,155 668,149 692,145
        C 724,140 758,140 788,124
        Z
      " />

      {/* LERX — leading edge root extension, signature F-16 feature */}
      <path d="
        M 620,68
        C 600,70 580,80 560,94
        L 546,110
        L 555,112
        L 612,112
        C 622,104 628,92 634,82
        C 636,76 630,70 620,68
        Z
      " />

      {/* Main wing — cropped delta */}
      <path d="
        M 545,110
        L 456,110
        L 410,202
        C 432,208 458,205 480,196
        C 502,187 522,172 538,156
        C 552,142 566,128 580,118
        L 612,112
        L 555,112
        Z
      " />

      {/* Vertical tail — tall and slightly forward-swept */}
      <path d="
        M 128,121
        C 123,114 118,102 112,85
        C 106,67 102,48  97,34
        C 92,20  84,11   73,10
        C 62,9   52,16   45,30
        C 38,44  36,62   37,82
        C 37,102 42,116  49,124
        L 110,120
        Z
      " />

      {/* Horizontal stabilizer / taileron */}
      <path d="
        M 118,135
        L 108,178
        L 52,188
        L 40,166
        L 45,135
        Z
      " />

      {/* Ventral fin */}
      <path d="
        M 232,150
        L 222,196
        L 252,196
        L 265,150
        Z
      " />

      {/* Two-seat tandem canopy — X-62 VISTA is an F-16D (two-seater) */}
      <path d="
        M 576,66
        C 560,60 542,56 524,56
        C 506,56 488,60 472,68
        C 457,76 444,88 432,95
        C 422,100 412,104 402,104
        C 390,104 378,100 366,95
        L 352,88
        C 366,80 380,72 396,68
        C 412,64 430,62 450,62
        C 470,62 492,65 516,66
        C 538,67 558,66 576,66
        Z
      " />
    </svg>
  )
}
