import requests
import time
import random
from bs4 import BeautifulSoup
# from keybert import KeyBERT
from sentence_transformers import SentenceTransformer
# from konlpy.tag import Okt
from kiwipiepy import Kiwi
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import bigquery
from datetime import date
import numpy as np

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}

categories = {
    '경제': 'https://news.naver.com/section/101',
    '사회': 'https://news.naver.com/section/102',
    '생활/문화': 'https://news.naver.com/section/103',
}

print("모델 로딩 중...")
# okt = Okt()
kiwi = Kiwi()
model = SentenceTransformer('jhgan/ko-sroberta-multitask')
print("모델 로딩 완료!")

def get_top10_links(category_url):
    resp = requests.get(category_url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    links = []
    for a in soup.select('a.sa_text_title'):
        href = a.get('href')
        if href and 'mnews' in href:
            links.append(href)
        if len(links) >= 10:
            break
    return links

def get_article_text(article_url):
    resp = requests.get(article_url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    content = soup.select_one('#dic_area')
    if content:
        return content.get_text()
    return ''

def extract_keywords(text, top_n=6):
    # nouns = okt.nouns(text)
    # nouns = [n for n in nouns if len(n) >= 2]
    result = kiwi.analyze(text)
    nouns = [
        token.form for sent in result[0][0]
        for token in [sent] if token.tag.startswith('NN')  # NN: 일반명사, NNP: 고유명사
        and len(token.form) >= 2
    ]
    if not nouns:
        return []

    tokenized_nouns = ' '.join(nouns)
    count = CountVectorizer(ngram_range=(1, 1)).fit([tokenized_nouns])
    candidates = count.get_feature_names_out()

    doc_embedding = model.encode([text])
    candidate_embeddings = model.encode(candidates)

    word_doc_similarity = cosine_similarity(candidate_embeddings, doc_embedding)
    top_idx = np.argsort(word_doc_similarity[:, 0])[::-1][:top_n]

    return [candidates[i] for i in top_idx]

# 오늘 날짜
today = date.today().strftime('%Y-%m-%d')
news_month = date.today().strftime('%Y-%m')

rows = []

for category_name, url in categories.items():
    print(f"\n[{category_name}] 크롤링 시작")
    links = get_top10_links(url)
    time.sleep(random.uniform(1, 3))

    for link in links:
        text = get_article_text(link)
        if not text:
            continue

        keywords = extract_keywords(text)
        print(f"기사: {link}")
        print(f"키워드: {keywords}")

        for keyword in keywords:
            rows.append({
                'date': today,
                'keyword': keyword,
                'category': category_name,
            })

        time.sleep(random.uniform(1, 3))

print(f"\n총 {len(rows)}개 키워드 수집 완료")

# BigQuery 적재
import pandas as pd
df = pd.DataFrame(rows)

client = bigquery.Client(project='keyword-trend-496008')
table_id = 'keyword-trend-496008.keyword_trend.news_daily_raw'

job_config = bigquery.LoadJobConfig(
    write_disposition='WRITE_APPEND',  # 매일 추가
)

job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
job.result()
print(f"BigQuery 적재 완료: {len(df)}행")