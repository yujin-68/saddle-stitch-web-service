import React, { useState, useRef, useEffect } from 'react';
import { FileDown, Image, XCircle } from 'lucide-react';

// jsPDF 라이브러리를 CDN을 통해 동적으로 로드합니다.
const loadJsPDF = () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// 메인 앱 컴포넌트
export default function App() {
  const [files, setFiles] = useState([]); // 업로드된 파일 목록
  const [reorderedImages, setReorderedImages] = useState([]); // 순서가 재구성된 이미지 목록
  const fileInputRef = useRef(null); // 파일 인풋 엘리먼트 참조
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const [draggingIndex, setDraggingIndex] = useState(null); // 드래그 중인 이미지의 인덱스

  // 파일 업로드 핸들러
  const handleFileChange = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(uploadedFiles);
  };

  // 파일 선택을 취소하는 함수
  const clearFiles = () => {
    setFiles([]);
    setReorderedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 드래그 시작 핸들러
  const handleDragStart = (index) => {
    setDraggingIndex(index);
  };

  // 드래그 오버 핸들러
  const handleDragOver = (event, index) => {
    event.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    // 드롭 대상 인덱스와 드래그 중인 인덱스가 다르면 순서 변경
    const newFiles = [...files];
    const draggedFile = newFiles[draggingIndex];
    newFiles.splice(draggingIndex, 1);
    newFiles.splice(index, 0, draggedFile);

    setFiles(newFiles);
    setDraggingIndex(index);
  };

  // 드래그 종료 핸들러
  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  // 중철제본 로직을 적용하여 페이지 순서를 재구성하는 함수
  const reorderPages = (originalFiles) => {
    const numFiles = originalFiles.length;
    let paddedFiles = [...originalFiles];
    let numPages = numFiles;
    if (numPages % 4 !== 0) {
      const paddingCount = 4 - (numPages % 4);
      for (let i = 0; i < paddingCount; i++) {
        paddedFiles.push(null); // 빈 페이지를 나타내기 위해 null 추가
      }
      numPages = paddedFiles.length;
    }

    const newOrder = [];
    let left = 0;
    let right = numPages - 1;

    let groupIndex = 0;
    while (left < right) {
      if (groupIndex % 2 === 0) {
        // 홀수 번째 묶음 (0, 2, ...) -> [right, left] 순서
        newOrder.push(right, left);
      } else {
        // 짝수 번째 묶음 (1, 3, ...) -> [left, right] 순서로 순서 변경
        newOrder.push(left, right);
      }
      left++;
      right--;
      groupIndex++;
    }

    const reordered = newOrder.map((pageIndex) => {
      // 페이지 번호를 포함하는 객체로 반환
      return {
        file: paddedFiles[pageIndex],
        originalIndex: pageIndex
      };
    });

    return reordered;
  };

  // 파일이 업데이트될 때마다 순서를 재구성하고 미리보기를 생성
  useEffect(() => {
    if (files.length === 0) {
      setReorderedImages([]);
      return;
    }

    const reorderedFiles = reorderPages(files);
    
    // 미리보기 이미지 URL 생성
    const newImageUrls = reorderedFiles.map((item) => {
      return item.file ? URL.createObjectURL(item.file) : 'https://placehold.co/100x150/e5e7eb/6b7280?text=빈+페이지';
    });
    setReorderedImages(newImageUrls);
  }, [files]);

  // PDF 다운로드 핸들러
  const handleDownload = async () => {
    if (files.length === 0) {
      console.log('먼저 이미지를 업로드해주세요.');
      return;
    }

    setIsLoading(true);
    let jsPDF;
    try {
      jsPDF = await loadJsPDF();
    } catch (error) {
      console.error("jsPDF 라이브러리를 로드할 수 없습니다.", error);
      setIsLoading(false);
      return;
    }

    const reorderedFiles = reorderPages(files);
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // 로딩 상태를 표시하는 동안 버튼을 비활성화
    const button = document.getElementById('downloadButton');
    const originalText = button.innerHTML;
    button.innerHTML = 'PDF 생성 중...';
    button.disabled = true;

    for (let i = 0; i < reorderedFiles.length; i += 2) {
      if (i > 0) {
        doc.addPage();
      }

      const halfWidth = doc.internal.pageSize.getWidth() / 2;
      const halfHeight = doc.internal.pageSize.getHeight();
      
      const leftFileItem = reorderedFiles[i];
      if (leftFileItem.file) {
        try {
          const imgData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(leftFileItem.file);
          });

          // HTML Image Element를 사용하여 가로 세로 비율 계산
          const img = new window.Image();
          img.src = imgData;
          await new Promise(resolve => img.onload = resolve); // 이미지 로딩 대기
          
          const imgAspectRatio = img.width / img.height;

          // 새로운 이미지 크기 계산 (너비는 페이지 절반에 맞추고 높이는 비율 유지)
          const newWidth = halfWidth;
          const newHeight = newWidth / imgAspectRatio;
          const yPosition = (halfHeight - newHeight) / 2;

          doc.addImage(imgData, 'JPEG', 0, yPosition, newWidth, newHeight, null, 'FAST');
        } catch (e) {
          console.error(`Error processing left image: ${e}`);
        }
      }

      const rightFileItem = reorderedFiles[i + 1];
      if (rightFileItem && rightFileItem.file) {
        try {
          const imgData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(rightFileItem.file);
          });

          // HTML Image Element를 사용하여 가로 세로 비율 계산
          const img = new window.Image();
          img.src = imgData;
          await new Promise(resolve => img.onload = resolve); // 이미지 로딩 대기

          const imgAspectRatio = img.width / img.height;

          // 새로운 이미지 크기 계산 (너비는 페이지 절반에 맞추고 높이는 비율 유지)
          const newWidth = halfWidth;
          const newHeight = newWidth / imgAspectRatio;
          const yPosition = (halfHeight - newHeight) / 2;

          doc.addImage(imgData, 'JPEG', halfWidth, yPosition, newWidth, newHeight, null, 'FAST');
        } catch (e) {
          console.error(`Error processing right image: ${e}`);
        }
      }
    }
    
    doc.save('saddle-stitch-book.pdf');
    
    // 상태 복구
    button.innerHTML = originalText;
    button.disabled = false;
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-indigo-700">
          중철제본 PDF 생성기
        </h1>
        <p className="text-center text-lg mb-8 text-gray-600">
          여러 장의 이미지를 업로드하고 순서를 바꾼 뒤 PDF를 만드세요.
        </p>

        {/* 파일 업로드 섹션 */}
        <div className="flex flex-col items-center justify-center gap-4 mb-8">
          <label
            htmlFor="file-upload"
            className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-md transition-colors cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
          >
            <Image size={24} />
            <span>이미지 업로드</span>
            <input
              id="file-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
              disabled={isLoading}
            />
          </label>
          <button
            onClick={clearFiles}
            className={`flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-bold shadow-md transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
            disabled={isLoading}
          >
            <XCircle size={24} />
            <span>초기화</span>
          </button>
        </div>

        {/* 업로드된 이미지 미리보기 섹션 (드래그 앤 드롭 가능) */}
        {files.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-center">업로드된 이미지 순서</h2>
            <p className="text-center text-gray-500 mb-4">드래그 앤 드롭으로 순서를 변경할 수 있습니다.</p>
            <div className="flex flex-wrap justify-center gap-4 border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex flex-col items-center cursor-move transition-transform duration-200 ${draggingIndex === index ? 'opacity-50 scale-95' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="text-sm font-semibold text-gray-500 mb-1">원본 {index + 1}</span>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`페이지 ${index + 1}`}
                    className="w-24 h-36 object-cover rounded-lg shadow-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 재구성된 페이지 미리보기 섹션 (두 페이지씩 묶어서) */}
        {reorderedImages.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-center">중철제본 페이지 미리보기</h2>
            <div className="flex flex-wrap justify-center gap-4 border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
              {reorderedImages.reduce((acc, curr, index) => {
                if (index % 2 === 0) {
                  const leftPageUrl = reorderedImages[index];
                  const rightPageUrl = reorderedImages[index + 1];
                  
                  const reorderedFiles = reorderPages(files);
                  const leftPageItem = reorderedFiles[index];
                  const rightPageItem = reorderedFiles[index + 1];

                  acc.push(
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-gray-500 mb-1">
                          페이지 {leftPageItem.originalIndex + 1}
                        </span>
                        <img
                          src={leftPageUrl}
                          alt={`재구성된 페이지 ${index + 1}`}
                          className="w-24 h-36 object-cover rounded-lg shadow-sm"
                        />
                      </div>
                      {rightPageItem && (
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-semibold text-gray-500 mb-1">
                            페이지 {rightPageItem.originalIndex + 1}
                          </span>
                          <img
                            src={rightPageUrl}
                            alt={`재구성된 페이지 ${index + 2}`}
                            className="w-24 h-36 object-cover rounded-lg shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                }
                return acc;
              }, [])}
            </div>
          </div>
        )}

        {/* PDF 다운로드 버튼 */}
        {files.length > 0 && (
          <div className="text-center">
            <button
              id="downloadButton"
              onClick={handleDownload}
              className={`flex items-center justify-center mx-auto gap-2 px-8 py-4 bg-green-500 text-white rounded-full font-bold text-lg shadow-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
              disabled={isLoading}
            >
              <FileDown size={28} />
              <span>{isLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
