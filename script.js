// Initialize CodeMirror with enhanced options
const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
    mode: 'javascript',
    theme: 'monokai',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    matchTags: true,
    autoCloseTags: true,
    styleActiveLine: true,
    showTrailingSpace: true,
    highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
    extraKeys: {
        "Ctrl-Enter": function (cm) { handleRunCode(); },
        "Cmd-Enter": function (cm) { handleRunCode(); },
        "Ctrl-F": function (cm) { handleFormatCode(); },
        "Cmd-F": function (cm) { handleFormatCode(); },
        "Ctrl-Space": "autocomplete",
        "Ctrl-/": "toggleComment",
        "Cmd-/": "toggleComment",
        "Alt-F": "findPersistent",
        "Tab": function (cm) {
            if (cm.somethingSelected()) {
                cm.indentSelection("add");
            } else {
                cm.replaceSelection(cm.getOption("indentWithTabs") ? "\t" :
                    Array(cm.getOption("indentUnit") + 1).join(" "), "end", "+input");
            }
        },
        "Shift-Tab": function (cm) {
            cm.indentSelection("subtract");
        }
    },
    hintOptions: {
        completeSingle: false,
        completeOnSingleClick: true
    },
    autofocus: true,
    workTime: 20,
    workDelay: 300
});

// Set default code
editor.setValue(`// Welcome to JS Playground!
// Try writing some JavaScript code here
// Keyboard shortcuts:
// Ctrl/Cmd + Enter: Run code
// Ctrl/Cmd + F: Format code
// Ctrl/Cmd + /: Toggle comment
// Ctrl + Space: Show autocomplete
// Alt + F: Find/Replace
// Tab/Shift+Tab: Indent/Unindent

function example() {
  const greeting = "Hello, World!";
  console.log(greeting);
  
  // Try different console outputs
  console.log(42);
  console.log({ key: "value" });
  console.log([1, 2, 3]);
}

example();`);

const handleFormatCode = () => {
    try {
        const currentCode = editor.getValue();
        const formattedCode = prettier.format(currentCode, {
            parser: "babel",
            plugins: prettierPlugins,
            semi: true,
            singleQuote: true,
            trailingComma: "es5",
            printWidth: 80,
            tabWidth: 2
        });
        editor.setValue(formattedCode);
    } catch (error) {
        console.error('Formatting error:', error);
    }
};

let autorunEnabled = true;

// Add after CodeMirror initialization
editor.on('change', debounce(() => {
    if (autorunEnabled) {
        handleRunCode();
    }
}, 1000));

// Add debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add after the button event listeners
const autorunToggle = document.getElementById('autorunToggle');
autorunToggle.addEventListener('change', (e) => {
    autorunEnabled = e.target.checked;
    if (autorunEnabled) {
        handleRunCode(); // Run immediately when enabling
    }
});

// Update the showError function to properly handle line numbers
const showError = (error) => {
    const errorFooter = document.getElementById('errorFooter');
    const errorMessage = document.getElementById('errorMessage');

    // Clear any existing error markers
    editor.getAllMarks().forEach(mark => mark.clear());

    let formattedMessage = '';
    let lineNumber = null;
    let columnNumber = null;

    if (typeof error === 'string') {
        formattedMessage = error;
    } else {
        formattedMessage = `${error.name || 'Error'}: ${error.message}`;

        // First try to use direct line/column numbers if available
        if (error.line) {
            lineNumber = error.line;
            columnNumber = error.column || 0;
        } else if (error.stack) {
            // Look for line numbers in different formats
            const lineMatches = [
                error.stack.match(/(?:eval|<anonymous>):(\d+):(\d+)/),
                error.stack.match(/at\s+(?:\w+\s+)?\(?.*?:(\d+):(\d+)\)?/),
                error.message.match(/(?:line\s+)?(\d+)(?:\s*,\s*column\s+)?(?::?\s*)?(\d+)?/)
            ].find(match => match !== null);

            if (lineMatches) {
                lineNumber = parseInt(lineMatches[1], 10);
                columnNumber = parseInt(lineMatches[2], 10) || 0;
            }
        }

        if (lineNumber !== null) {
            // Adjust for 0-based line numbers in CodeMirror
            const editorLine = lineNumber - 3;

            if (editor.getLine(editorLine) !== undefined) {
                const errorLine = editor.getLine(editorLine);

                // Add error marker
                editor.markText(
                    { line: editorLine, ch: 0 },
                    { line: editorLine, ch: errorLine.length },
                    {
                        className: 'error-line',
                        title: error.message
                    }
                );

                // Scroll to error line with some context
                editor.scrollIntoView({
                    line: editorLine,
                    ch: columnNumber - 1
                }, 50);

                // Add line and column information to the error message
                formattedMessage += ` at line ${lineNumber - 2}, column ${columnNumber}`;
            }
        }
    }

    errorMessage.textContent = formattedMessage;
    errorFooter.style.transform = 'translateY(0)';
};

const hideError = () => {
    const errorFooter = document.getElementById('errorFooter');
    errorFooter.style.transform = 'translateY(100%)';
};

// Add CSS for error highlighting
const style = document.createElement('style');
style.textContent = `
    .CodeMirror .error-line {
        background-color: rgba(239, 68, 68, 0.2);
        border-bottom: 2px wavy #ef4444;
        position: relative;
    }
    .CodeMirror .error-line:hover::after {
        content: attr(title);
        position: absolute;
        left: 0;
        top: 100%;
        background: #ef4444;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        white-space: pre-wrap;
        max-width: 300px;
    }
`;
document.head.appendChild(style);

// Update handleRunCode to better handle error line numbers
const handleRunCode = () => {
    try {
        const code = editor.getValue();

        // Clear any existing error markers
        editor.getAllMarks().forEach(mark => mark.clear());
        hideError();

        const iframe = document.getElementById('output');

        const template = document.createElement('template');
        template.innerHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/fira_code.css">
                <style>
                    body { 
                        font-family: 'Fira Code', monospace;
                        padding: 1rem;
                        margin: 0;
                        line-height: 1.6;
                    }
                    .error {
                        color: #ef4444;
                        padding: 8px;
                        background: #fee2e2;
                        border-radius: 4px;
                        margin: 8px 0;
                    }
                    .log {
                        margin: 4px 0;
                        padding: 4px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                </style>
            </head>
            <body>
                <script>
                    // Optimize console.log capture
                    const logs = [];
                    const originalLog = console.log;
                    console.log = (...args) => {
                        originalLog.apply(console, args);
                        const output = args.map(arg => 
                            typeof arg === 'object' ? 
                                JSON.stringify(arg, null, 2) : 
                                String(arg)
                        ).join(' ');
                        logs.push(output);
                        requestAnimationFrame(() => {
                            document.body.innerHTML += \`<div class="log">\${output}</div>\`;
                        });
                    };

                    // Improved error handling
                    window.onerror = (msg, url, lineNo, columnNo, error) => {
                        // Extract line number from error stack
                        let errorLine = lineNo;
                        let errorColumn = columnNo;
                        
                        // Try to get more accurate line numbers from the error stack
                        const stackMatch = error?.stack?.match(/(<anonymous>|eval):(\d+):(\d+)/);
                        if (stackMatch) {
                            errorLine = parseInt(stackMatch[2], 10);
                            errorColumn = parseInt(stackMatch[3], 10);
                        }
                        
                        parent.postMessage({
                            type: 'error',
                            error: {
                                message: msg,
                                line: errorLine,
                                column: errorColumn,
                                stack: error?.stack
                            }
                        }, '*');
                        return false;
                    };

                    // Wrap code execution in try-catch with line number preservation
                    try {
                        // Add line information preservation
                        const wrappedCode = \`
                            try {
                                ${code}
                            } catch (e) {
                                if (!e.line) {
                                    const match = e.stack?.match(/(<anonymous>|eval):(\d+):(\d+)/);
                                    if (match) {
                                        e.line = parseInt(match[2], 10);
                                        e.column = parseInt(match[3], 10);
                                    }
                                }
                                throw e;
                            }
                        \`;
                        eval(wrappedCode);
                    } catch (error) {
                        window.onerror(error.message, '', error.line || 0, error.column || 0, error);
                    }
                </script>
            </body>
            </html>
        `;

        iframe.srcdoc = template.innerHTML;
    } catch (error) {
        console.error('Error running code:', error);
        showError(error);
    }
};

// Update the editor change handler
editor.on('change', debounce(() => {
    try {
        new Function(editor.getValue());
        hideError();
    } catch (error) {
        showError(error);  // Pass the full error object
    }
}, 300));

// Add event listeners
const runButton = document.getElementById('runButton');
const formatButton = document.getElementById('formatButton');

runButton.addEventListener('click', handleRunCode, { passive: true });
formatButton.addEventListener('click', handleFormatCode, { passive: true });

// Use more efficient event delegation for keyboard events
document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target.matches('#runButton, #formatButton')) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            target.click();
        }
    }
}, { passive: false });

// Add resizer functionality
const initResizer = () => {
    const resizer = document.getElementById('resizer');
    const leftPane = document.getElementById('editorPane');
    const rightPane = document.getElementById('outputPane');
    const iframe = document.getElementById('output');

    let isResizing = false;
    let startX;
    let leftStartWidth;
    let rightStartWidth;

    const startResizing = (e) => {
        isResizing = true;
        startX = e.clientX;

        // Store both panes' starting widths
        leftStartWidth = leftPane.getBoundingClientRect().width;
        rightStartWidth = rightPane.getBoundingClientRect().width;

        // Add dragging class
        resizer.classList.add('dragging');

        // Prevent selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        // Add overlay to prevent iframe from capturing events
        iframe.style.pointerEvents = 'none';
    };

    const stopResizing = () => {
        if (!isResizing) return;

        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // Re-enable iframe events
        iframe.style.pointerEvents = 'auto';

        // Refresh CodeMirror after resize
        editor.refresh();
    };

    const resize = (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const dx = e.clientX - startX;
            const containerWidth = resizer.parentNode.getBoundingClientRect().width;

            let newLeftWidth = leftStartWidth + dx;
            let newRightWidth = rightStartWidth - dx;

            let leftWidthPercent = (newLeftWidth / containerWidth) * 100;
            let rightWidthPercent = (newRightWidth / containerWidth) * 100;

            if (leftWidthPercent < 20) {
                leftWidthPercent = 20;
                rightWidthPercent = 80;
            } else if (leftWidthPercent > 80) {
                leftWidthPercent = 80;
                rightWidthPercent = 20;
            }

            leftPane.style.width = `${leftWidthPercent}%`;
            rightPane.style.width = `${rightWidthPercent}%`;

            editor.refresh();
        });
    };

    // Mouse events
    resizer.addEventListener('mousedown', startResizing);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);

    // Touch events for mobile
    resizer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        startResizing({ clientX: touch.clientX });
    });
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        resize({ clientX: touch.clientX });
    });
    document.addEventListener('touchend', stopResizing);

    // Keyboard accessibility
    resizer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const containerWidth = resizer.parentNode.getBoundingClientRect().width;
            const leftWidth = leftPane.getBoundingClientRect().width;
            const delta = e.key === 'ArrowLeft' ? -20 : 20;

            let newLeftWidthPercent = ((leftWidth + delta) / containerWidth) * 100;
            newLeftWidthPercent = Math.min(Math.max(newLeftWidthPercent, 20), 80);

            leftPane.style.width = `${newLeftWidthPercent}%`;
            rightPane.style.width = `${100 - newLeftWidthPercent}%`;

            editor.refresh();
        }
    });
};

// Initialize the resizer after the page loads
initResizer();

// Initial run
handleRunCode();

// Add after editor initialization
editor.on("inputRead", function (cm, change) {
    if (change.origin !== "+input") return;
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);

    if (token.type === "variable" || token.type === "property") {
        CodeMirror.commands.autocomplete(cm, null, { completeSingle: false });
    }
});

// Add message event listener to handle runtime errors from iframe
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'error') {
        const error = event.data.error;
        if (error) {
            const customError = new Error(error.message);
            customError.lineNumber = error.line;
            customError.columnNumber = error.column;
            customError.stack = error.stack;
            showError(customError);
        }
    }
}); 