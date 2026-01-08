from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from model_handler import KhmerSummarizer
import warnings

# Optional: suppress keras / numpy future warnings
warnings.filterwarnings("ignore", category=FutureWarning)

app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)

CORS(app)

# Initialize the summarizer
summarizer = KhmerSummarizer(
    model_path="./models/khmer_summarization_model"
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json(force=True)

        text = data.get('text', '')
        max_length = int(data.get('max_length', 150))
        min_length = int(data.get('min_length', 50))

        if not text:
            return jsonify({'error': 'គ្មានអត្ថបទ (No text provided)'}), 400

        if len(text.strip()) < 10:
            return jsonify({'error': 'អត្ថបទខ្លីពេក (Text too short)'}), 400

        summary = summarizer.summarize(text, max_length, min_length)

        return jsonify({
            'success': True,
            'summary': summary,
            'original_length': len(text),
            'summary_length': len(summary)
        })

    except Exception as e:
        print(f"Error in /api/summarize: {e}")
        return jsonify({'error': f'កំហុស: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': summarizer.is_loaded(),
        'tokenizer_loaded': summarizer.tokenizer is not None
    })

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("Starting Khmer Text Summarization Server")
    print("=" * 60)
    print("UI:  http://localhost:5000")
    print("API: http://localhost:5000/api/summarize")
    print("Health: http://localhost:5000/api/health")
    print("=" * 60 + "\n")

    app.run(host='0.0.0.0', port=5000, debug=True)
